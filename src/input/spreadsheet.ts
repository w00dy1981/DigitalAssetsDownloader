import { Workbook, CellValue, Worksheet, Cell, ValueType } from 'exceljs';
import { parse } from 'fast-csv';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

export interface SheetData {
  columns: string[];
  rows: Record<string, string>[];
}

const isCsvFile = (filename: string): boolean =>
  filename.toLowerCase().endsWith('.csv');

export async function getSheetNames(filePath: string): Promise<string[]> {
  if (isCsvFile(filePath)) return ['Sheet1'];
  const workbook = await new Workbook().xlsx.read(createReadStream(filePath));
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
  if (isCsvFile(filePath)) {
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
    await pipeline(createReadStream(filePath), parser);
    return data;
  }
  const workbook = await new Workbook().xlsx.read(createReadStream(filePath));
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found in the workbook`);
  return readSheet(sheet);
}
