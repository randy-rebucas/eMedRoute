import { decodeCsvBytes, MAX_IMPORT_ROWS, normalizeDate, parseProductCsv, splitCsv } from '@/lib/productImport';

const HEADER = 'name,category,manufacturer,description,packaging,expiryDate\n';
const ROW = 'Amlodipine,Antihypertensive,Acme,Calcium channel blocker,Box of 30,2027-03-31\n';

describe('decodeCsvBytes', () => {
  it('reads UTF-8, and Excel’s Windows-1252 when the bytes aren’t UTF-8', () => {
    expect(decodeCsvBytes(new Uint8Array([0x50, 0xc3, 0xb1, 0x61]))).toBe('Pña');
    expect(decodeCsvBytes(new Uint8Array([0x50, 0x61, 0x72, 0x61, 0xf1, 0x61, 0x71, 0x75, 0x65]))).toBe('Parañaque');
    expect(decodeCsvBytes(new Uint8Array([0x93, 0x41, 0x94, 0x80]))).toBe('“A”€');
  });
});

describe('splitCsv', () => {
  it('handles quotes, escaped quotes, line breaks in cells, CRLF and a BOM', () => {
    expect(splitCsv('﻿a,"x,y","he said ""hi"""\r\n1,"two\nlines",3')).toEqual([
      ['a', 'x,y', 'he said "hi"'],
      ['1', 'two\nlines', '3'],
    ]);
  });

  it('opens a quoted cell after spaces', () => {
    expect(splitCsv('a, "x,y",b')).toEqual([['a', 'x,y', 'b']]);
  });

  it('takes semicolons when the header uses them', () => {
    expect(splitCsv('a;b\n1,5;2')).toEqual([
      ['a', 'b'],
      ['1,5', '2'],
    ]);
  });

  it('stops after maxRows non-blank rows', () => {
    expect(splitCsv('h\n1\n\n2\n3\n4', 2)).toHaveLength(4);
  });
});

describe('normalizeDate', () => {
  it('takes Y-M-D only, and real days only', () => {
    expect(normalizeDate('2027/3/1')).toBe('2027-03-01');
    expect(normalizeDate('2027-02-30')).toBeNull();
    expect(normalizeDate('01/03/2027')).toBeNull();
  });
});

describe('parseProductCsv', () => {
  it('keeps spreadsheet row numbers and reports problems per row', () => {
    const parsed = parseProductCsv(HEADER + ROW + '\n' + 'X,,Acme,D,Box,someday\n');
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.rows.map((r) => r.line)).toEqual([2, 4]);
    expect(parsed.rows[0].problems).toEqual([]);
    expect(parsed.rows[1].problems).toEqual(
      expect.arrayContaining([{ kind: 'missing', fields: ['category'] }, { kind: 'badDate', value: 'someday' }])
    );
  });

  it(`takes ${MAX_IMPORT_ROWS} rows and refuses more`, () => {
    expect(parseProductCsv(HEADER + ROW.repeat(MAX_IMPORT_ROWS)).ok).toBe(true);
    expect(parseProductCsv(HEADER + ROW.repeat(MAX_IMPORT_ROWS + 1))).toMatchObject({ ok: false, error: 'tooManyRows' });
  });

  it('refuses a spreadsheet file and a missing column', () => {
    expect(parseProductCsv(HEADER + ROW, 'products.xlsx')).toMatchObject({ ok: false, error: 'notCsv' });
    expect(parseProductCsv('name,category\nA,B\n')).toMatchObject({ ok: false, error: 'missingColumns' });
  });

  it('skips blank lines before the header and keeps the file’s row numbers (comma)', () => {
    const parsed = parseProductCsv('\n\r\n' + HEADER + ROW + '\n' + ROW);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.rows.map((r) => r.line)).toEqual([4, 6]);
    expect(parsed.rows.every((r) => !r.problems.length)).toBe(true);
    expect(parsed.rows[0].input.name).toBe('Amlodipine');
  });

  it('reads the delimiter from the header after blank lines (semicolon)', () => {
    const semi = (line: string) => line.replace(/,/g, ';');
    const parsed = parseProductCsv('\n' + semi(HEADER) + 'Paracetamol;Analgesic;Acme;Pain, fever;Box of 10;2027-03-31\n');
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({ line: 3, problems: [], input: { name: 'Paracetamol', description: 'Pain, fever' } });
  });
});
