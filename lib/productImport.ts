import { apiRequest } from './api';
import { emitRefresh } from './events';
import { PRODUCT_STATUSES, ProductInput, ProductStatus } from './types';

const IMPORT_PATH = '/api/medical-representatives/products/import';

/** The server's cap on one import (MOBILE_API.md → products/import). */
export const MAX_IMPORT_ROWS = 200;

/** The text columns; the pack size has its own two (packCount, packUnit). */
export type ImportField = Exclude<keyof ProductInput, 'packSize'>;

/** Columns in the order the template lists them. The first six are required. */
export const IMPORT_COLUMNS: { field: ImportField; required: boolean }[] = [
  { field: 'name', required: true },
  { field: 'category', required: true },
  { field: 'manufacturer', required: true },
  { field: 'description', required: true },
  { field: 'packaging', required: true },
  { field: 'expiryDate', required: true },
  { field: 'strength', required: false },
  { field: 'dosage', required: false },
  { field: 'status', required: false },
];

/** Same limits as the server (rep-product-input.ts). */
const MAX_LENGTH: Record<ImportField, number> = {
  name: 200,
  category: 100,
  manufacturer: 200,
  description: 2000,
  packaging: 200,
  expiryDate: 10,
  strength: 200,
  dosage: 200,
  status: 20,
};

/** Header spellings people use, after lowercasing and dropping spaces and punctuation. */
const HEADER_ALIASES: Record<string, ImportField> = {
  name: 'name',
  productname: 'name',
  product: 'name',
  category: 'category',
  manufacturer: 'manufacturer',
  description: 'description',
  packaging: 'packaging',
  pack: 'packaging',
  expirydate: 'expiryDate',
  expiry: 'expiryDate',
  expiration: 'expiryDate',
  expirationdate: 'expiryDate',
  strength: 'strength',
  dosage: 'dosage',
  status: 'status',
};

/** Optional pack size columns ("30" and "tablets"), header spellings after normalising. */
const PACK_COUNT_HEADERS = ['packcount', 'packsize', 'unitsperpack', 'perpack'];
const PACK_UNIT_HEADERS = ['packunit', 'packsizeunit'];

export const IMPORT_TEMPLATE =
  'name,category,manufacturer,description,packaging,expiryDate,strength,dosage,status,packCount,packUnit\n' +
  'Amlodipine,Antihypertensive,Acme Pharma,Calcium channel blocker for hypertension,Box of 30 tablets,2027-03-31,5 mg,1 tablet once a day,active,30,tablets\n';

export type RowProblem =
  | { kind: 'missing'; fields: ImportField[] }
  | { kind: 'tooLong'; field: ImportField; max: number }
  | { kind: 'badDate'; value: string }
  | { kind: 'badStatus'; value: string }
  | { kind: 'badPack'; value: string };

/** One data row of the file. `line` is the spreadsheet row number (the header is row 1). */
export type ImportRow = { line: number; input: ProductInput; problems: RowProblem[] };

export type ParsedImport =
  | { ok: true; rows: ImportRow[] }
  | { ok: false; error: 'empty' | 'notCsv' | 'missingColumns' | 'tooManyRows'; columns?: ImportField[] };

/**
 * Split CSV text into rows of cells (RFC 4180: quoted cells may hold commas, quotes as "" and
 * line breaks). Takes a comma or semicolon, whichever the header line uses (Excel writes
 * semicolons where the comma is the decimal mark).
 */
export function splitCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** "2027-03-31" or "2027/3/31" → "2027-03-31"; anything else (D/M/Y is ambiguous) → null. */
export function normalizeDate(value: string): string | null {
  const m = value.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Read a product spreadsheet saved as CSV: map the header to fields, then check every row with
 * the server's rules so the rep sees every problem before anything is sent.
 */
export function parseProductCsv(text: string, fileName?: string): ParsedImport {
  if (fileName && /\.(xlsx?|numbers|ods)$/i.test(fileName)) return { ok: false, error: 'notCsv' };
  const table = splitCsv(text).filter((r) => r.some((c) => c.trim() !== ''));
  if (table.length < 2) return { ok: false, error: 'empty' };

  const normalized = table[0].map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
  const header = normalized.map((h) => HEADER_ALIASES[h]);
  const packCountAt = normalized.findIndex((h) => PACK_COUNT_HEADERS.includes(h));
  const packUnitAt = normalized.findIndex((h) => PACK_UNIT_HEADERS.includes(h));
  const missingColumns = IMPORT_COLUMNS.filter((c) => c.required && !header.includes(c.field)).map((c) => c.field);
  if (missingColumns.length) return { ok: false, error: 'missingColumns', columns: missingColumns };
  if (table.length - 1 > MAX_IMPORT_ROWS) return { ok: false, error: 'tooManyRows' };

  // Data rows keep their spreadsheet numbers: blank rows still count, so "row 7" matches the file.
  const all = splitCsv(text);
  const rows: ImportRow[] = [];
  all.forEach((cells, index) => {
    if (index === 0 || !cells.some((c) => c.trim() !== '')) return;
    const value = (field: ImportField) => {
      const at = header.indexOf(field);
      return at >= 0 ? (cells[at] ?? '').trim() : '';
    };
    const problems: RowProblem[] = [];
    const missing = IMPORT_COLUMNS.filter((c) => c.required && !value(c.field)).map((c) => c.field);
    if (missing.length) problems.push({ kind: 'missing', fields: missing });
    for (const { field } of IMPORT_COLUMNS) {
      if (field !== 'expiryDate' && field !== 'status' && value(field).length > MAX_LENGTH[field]) {
        problems.push({ kind: 'tooLong', field, max: MAX_LENGTH[field] });
      }
    }
    const rawDate = value('expiryDate');
    const expiryDate = rawDate ? normalizeDate(rawDate) : '';
    if (rawDate && !expiryDate) problems.push({ kind: 'badDate', value: rawDate });
    const rawStatus = value('status').toLowerCase();
    const status = (rawStatus || 'active') as ProductStatus;
    if (!(PRODUCT_STATUSES as readonly string[]).includes(status)) problems.push({ kind: 'badStatus', value: value('status') });
    // Pack size: both cells or neither; a whole count of 1-10000 (server rule).
    const packCount = packCountAt >= 0 ? (cells[packCountAt] ?? '').trim() : '';
    const packUnit = packUnitAt >= 0 ? (cells[packUnitAt] ?? '').trim() : '';
    const validPack = /^\d+$/.test(packCount) && Number(packCount) >= 1 && Number(packCount) <= 10000 && !!packUnit && packUnit.length <= 50;
    if ((packCount || packUnit) && !validPack) problems.push({ kind: 'badPack', value: [packCount, packUnit].filter(Boolean).join(' ') });

    rows.push({
      line: index + 1,
      problems,
      input: {
        name: value('name'),
        category: value('category'),
        manufacturer: value('manufacturer'),
        description: value('description'),
        packaging: value('packaging'),
        expiryDate: expiryDate ?? '',
        strength: value('strength') || undefined,
        dosage: value('dosage') || undefined,
        status,
        ...(validPack ? { packSize: { count: Number(packCount), unit: packUnit } } : {}),
      },
    });
  });
  return { ok: true, rows };
}

export type ImportResult = { created: number; skipped: { row: number; name: string }[] };

/** Send the rows that passed. The server skips products the rep already has (name + strength). */
export async function importProducts(inputs: ProductInput[]): Promise<ImportResult> {
  const result = await apiRequest<ImportResult>(IMPORT_PATH, { method: 'POST', body: { products: inputs } });
  emitRefresh('products', 'dashboard');
  return result;
}
