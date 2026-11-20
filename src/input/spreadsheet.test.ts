import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Workbook } from 'exceljs';
import { getSheetNames, loadSheetData } from './spreadsheet';

it('reads the same mapped values across blank Excel columns and padded CSV headers', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asset-input-'));
  try {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Products');
    sheet.addRow([' Code ', null, 'URL']);
    sheet.addRow([{ formula: '1-1', result: 0 }, 'ignore', ' asset ']);
    const xlsx = join(dir, 'products.xlsx');
    await workbook.xlsx.writeFile(xlsx);
    const csv = join(dir, 'products.csv');
    await writeFile(csv, ' Code ,, URL \n0,ignore, asset \n');
    for (const [file, name] of [
      [xlsx, 'Products'],
      [csv, 'Sheet1'],
    ]) {
      expect(await getSheetNames(file)).toEqual([name]);
      expect(await loadSheetData(file, name)).toEqual({
        columns: ['Code', 'URL'],
        rows: [{ Code: '0', URL: 'asset' }],
      });
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
