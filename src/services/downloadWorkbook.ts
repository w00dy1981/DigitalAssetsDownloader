import * as fs from 'fs/promises';
import * as path from 'path';
import ExcelJS from 'exceljs';
import type { PlannedAsset, PlannedRow } from './downloadPlan';
import type { AssetResult } from './saveAsset';

const headers = [
  'Row',
  'Product Code',
  'URL',
  'Status',
  'HTTP Status',
  'Content-Type',
  'File Size (Bytes)',
  'Message',
  'Local File Path',
  'Photo File Path',
  'Product Data Sheet',
  'Background Processed',
];

function formatWorksheet(sheet: ExcelJS.Worksheet): void {
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  for (const column of sheet.columns) {
    let maxLength = 12;
    column.eachCell?.({ includeEmpty: true }, cell => {
      maxLength = Math.max(maxLength, String(cell.value ?? '').length);
    });
    column.width = Math.min(maxLength + 2, 80);
  }
}

export async function writeDownloadWorkbook(
  logFile: string,
  rows: readonly PlannedRow[],
  results: ReadonlyMap<PlannedAsset, AssetResult>
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Digital Asset Downloader';
  workbook.created = new Date();

  const log = workbook.addWorksheet('Download Log');
  log.addRow(headers);
  const importRows: { productCode: string; photo: string; pdfName: string }[] =
    [];
  for (const row of rows) {
    const image = row.assets.find(asset => asset.kind === 'image');
    const pdf = row.assets.find(asset => asset.kind === 'pdf');
    const imageResult = image && results.get(image);
    const pdfResult = pdf && results.get(pdf);
    const photo = imageResult?.success ? imageResult.networkPath : '';
    // ABM expects a filename for PDFs and a configured network path for images.
    const pdfName = pdfResult?.success ? path.basename(pdfResult.filePath) : '';
    for (const asset of row.assets) {
      const result = results.get(asset);
      if (!result) continue;
      log.addRow([
        row.rowNumber,
        row.productCode,
        result.url,
        result.success ? 'Success' : 'Failure',
        result.httpStatus,
        result.contentType,
        result.success ? result.fileSize : 0,
        result.success ? 'Success' : result.error,
        result.success ? result.filePath : '',
        asset.kind === 'image' ? photo : '',
        asset.kind === 'pdf' ? pdfName : '',
        result.success && result.backgroundProcessed ? 'Yes' : 'No',
      ]);
    }
    if (photo || pdfName)
      importRows.push({ productCode: row.productCode, photo, pdfName });
  }

  const includePhoto = importRows.some(row => row.photo);
  const includePdf = importRows.some(row => row.pdfName);
  const erp = workbook.addWorksheet('ERP Import');
  erp.addRow([
    'Product Code',
    ...(includePhoto ? ['Photo File Path'] : []),
    ...(includePdf ? ['Product Data Sheet'] : []),
  ]);
  for (const { productCode, photo, pdfName } of importRows) {
    erp.addRow([
      productCode,
      ...(includePhoto ? [photo] : []),
      ...(includePdf ? [pdfName] : []),
    ]);
  }

  formatWorksheet(log);
  formatWorksheet(erp);
  await fs.mkdir(path.dirname(logFile), { recursive: true });
  await workbook.xlsx.writeFile(logFile);
}
