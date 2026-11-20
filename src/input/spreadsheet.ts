import { Workbook, CellValue, Worksheet, Cell, ValueType } from 'exceljs';
import { parse } from 'fast-csv';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { sanitizePath } from '../files/pathSecurity';

export interface SheetData {
  columns: string[];
  rows: Record<string, string>[];
}

const isCsvFile = (filename: string): boolean =>
  filename.toLowerCase().endsWith('.csv');

async function within<T>(operation: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                'File reading timed out. Check the file location and try again.'
              )
            ),
          ms
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function inputPath(filePath: string) {
  const safePath = sanitizePath(filePath);
  const info = await within(
    stat(safePath).catch(() => null),
    5000
  );
  if (!info?.isFile()) {
    throw new Error('File does not exist or is not accessible');
  }
  return safePath;
}

async function readWorkbook(filePath: string) {
  return within(new Workbook().xlsx.readFile(filePath), 30_000);
}

export async function getSheetNames(filePath: string): Promise<string[]> {
  const safePath = await inputPath(filePath);
  if (isCsvFile(safePath)) return ['Sheet1'];
  const workbook = await readWorkbook(safePath);
  const names = workbook.worksheets.map(sheet => sheet.name);
  if (!names.length) throw new Error('No worksheets found in the Excel file');
  return names;
}

function cellText(value: CellValue): string {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    if ('result' in value) return cellText(value.result);
    if ('richText' in value)
      return value.richText
        .map(run => run.text)
        .join('')
        .trim();
    if ('text' in value) return value.text.trim();
  }
  return String(value ?? '').trim();
}

function readCell(cell: Cell) {
  return cellText(cell.type === ValueType.Formula ? cell.result : cell.value);
}

function readSheet(sheet: Worksheet): SheetData {
  const headers = new Map<number, string>();
  sheet.getRow(1).eachCell((cell, index) => {
    const name = readCell(cell);
    if (name) headers.set(index, name);
  });
  if (!headers.size)
    throw new Error('The first row of the sheet must contain column names.');

  const rows: SheetData['rows'] = [];
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const values = Array.from(headers, ([index, name]) => [
      name,
      readCell(row.getCell(index)),
    ]);
    if (values.some(([, value]) => value))
      rows.push(Object.fromEntries(values));
  });
  return { columns: [...headers.values()], rows };
}

export async function loadSheetData(
  filePath: string,
  sheetName: string
): Promise<SheetData> {
  const safePath = await inputPath(filePath);
  if (isCsvFile(safePath)) {
    const data: SheetData = { columns: [], rows: [] };
    const parser = parse({
      headers: headers => headers.map(header => header?.trim() || undefined),
      trim: true,
      ignoreEmpty: true,
    });
    parser.on('headers', (headers: string[]) => {
      data.columns = headers.filter(Boolean);
    });
    parser.on('data', row => data.rows.push(row));
    await pipeline(createReadStream(safePath), parser);
    return data;
  }
  const workbook = await readWorkbook(safePath);
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found in the workbook`);
  return readSheet(sheet);
}
