import { apiRequest } from './api';
import { emitRefresh } from './events';
import { utf8Decode } from './offlineCache';
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

/** Windows-1252's 0x80–0x9F; the rest of the byte range is Latin-1. */
const CP1252_HIGH = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ';

function isUtf8(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    const extra = b < 0x80 ? 0 : b >= 0xc2 && b <= 0xdf ? 1 : b >= 0xe0 && b <= 0xef ? 2 : b >= 0xf0 && b <= 0xf4 ? 3 : -1;
    if (extra < 0 || i + extra >= bytes.length) return false;
    for (let k = 1; k <= extra; k++) if ((bytes[i + k] & 0xc0) !== 0x80) return false;
    i += extra + 1;
  }
  return true;
}

/**
 * A CSV file's text: UTF-8 (Excel's "CSV UTF-8", Google Sheets, Numbers), else Windows-1252,
 * Excel's plain "CSV" on Windows, so "Parañaque" doesn't arrive as "Para�aque".
 */
export function decodeCsvBytes(bytes: Uint8Array): string {
  if (isUtf8(bytes)) return utf8Decode(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    out += b >= 0x80 && b <= 0x9f ? CP1252_HIGH[b - 0x80] : String.fromCharCode(b);
  }
  return out;
}

/**
 * Split CSV text into rows of cells (RFC 4180: quoted cells may hold commas, quotes as "" and
 * line breaks; spaces before an opening quote are ignored). Takes a comma or semicolon, whichever
 * the header line uses (Excel writes semicolons where the comma is the decimal mark). With
 * `maxRows`, stops once more than that many non-blank rows are read, so an oversized file isn't
 * parsed to the end only to be refused.
 */
export function splitCsv(text: string, maxRows = Infinity): string[][] {
  const src = text.replace(/^﻿/, '');
  // The header is the first non-blank line: a file may start with empty lines.
  const firstLine = src.split(/\r\n|\r|\n/).find((line) => line.trim() !== '') ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let filled = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell.trim() === '') {
      quoted = true;
      cell = '';
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      if (row.some((c) => c.trim() !== '') && ++filled > maxRows) return rows;
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
  // The header plus one row too many is enough to refuse an oversized file.
  const all = splitCsv(text, MAX_IMPORT_ROWS + 1);
  const filled = (r: string[]) => r.some((c) => c.trim() !== '');
  const table = all.filter(filled);
  if (table.length < 2) return { ok: false, error: 'empty' };
  // Blank lines before the header are skipped, but still counted in row numbers.
  const headerAt = all.findIndex(filled);

  const normalized = table[0].map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
  const header = normalized.map((h) => HEADER_ALIASES[h]);
  const packCountAt = normalized.findIndex((h) => PACK_COUNT_HEADERS.includes(h));
  const packUnitAt = normalized.findIndex((h) => PACK_UNIT_HEADERS.includes(h));
  const missingColumns = IMPORT_COLUMNS.filter((c) => c.required && !header.includes(c.field)).map((c) => c.field);
  if (missingColumns.length) return { ok: false, error: 'missingColumns', columns: missingColumns };
  if (table.length - 1 > MAX_IMPORT_ROWS) return { ok: false, error: 'tooManyRows' };

  // Data rows keep their spreadsheet numbers: blank rows still count, so "row 7" matches the file.
  const rows: ImportRow[] = [];
  all.forEach((cells, index) => {
    if (index <= headerAt || !filled(cells)) return;
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
