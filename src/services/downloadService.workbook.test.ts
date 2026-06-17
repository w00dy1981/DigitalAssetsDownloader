import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import ExcelJS from 'exceljs';
import {
  buildErpImportRows,
  DownloadLogWorkbookRow,
  DownloadService,
} from './downloadService';
import { DownloadCompletionEvent, DownloadConfig } from '@/shared/types';

const createLogRow = (
  overrides: Partial<DownloadLogWorkbookRow>
): DownloadLogWorkbookRow => ({
  row: 1,
  productCode: 'PART1',
  url: 'https://example.com/asset',
  status: 'Success',
  httpStatus: 200,
  contentType: 'image/jpeg',
  fileSize: 100,
  message: 'Success',
  localFilePath: 'C:\\local\\PART1.jpg',
  photoFilePath: 'C:\\server\\PART1.jpg',
  productDataSheet: '',
  backgroundProcessed: 'No',
  ...overrides,
});

describe('DownloadService workbook output', () => {
  test('buildErpImportRows includes successful image rows only', () => {
    const importRows = buildErpImportRows([
      createLogRow({
        productCode: 'IMG1',
        photoFilePath: '\\\\server\\images\\IMG1.jpg',
      }),
      createLogRow({
        productCode: 'IMG2',
        status: 'Failure',
        photoFilePath: '',
        message: 'File not found',
      }),
    ]);

    expect(importRows).toEqual([
      {
        productCode: 'IMG1',
        photoFilePath: '\\\\server\\images\\IMG1.jpg',
      },
    ]);
  });

  test('buildErpImportRows includes successful PDF rows only', () => {
    const importRows = buildErpImportRows([
      createLogRow({
        productCode: 'PDF1',
        photoFilePath: '',
        productDataSheet: 'PDF1.PDF',
      }),
      createLogRow({
        productCode: 'PDF2',
        status: 'Failure',
        photoFilePath: '',
        productDataSheet: '',
      }),
    ]);

    expect(importRows).toEqual([
      {
        productCode: 'PDF1',
        productDataSheet: 'PDF1.PDF',
      },
    ]);
  });

  test('buildErpImportRows includes mixed successful asset columns', () => {
    const importRows = buildErpImportRows([
      createLogRow({
        productCode: 'MIX1',
        photoFilePath: '\\\\server\\images\\MIX1.jpg',
        productDataSheet: 'MIX1.PDF',
      }),
    ]);

    expect(importRows).toEqual([
      {
        productCode: 'MIX1',
        photoFilePath: '\\\\server\\images\\MIX1.jpg',
        productDataSheet: 'MIX1.PDF',
      },
    ]);
  });

  test('buildErpImportRows keeps a successful PDF value when the image row failed', () => {
    const importRows = buildErpImportRows([
      createLogRow({
        productCode: 'PDF_ONLY_SUCCESS',
        status: 'Failure',
        message: 'Image failed',
        photoFilePath: '',
        productDataSheet: 'PDF_ONLY_SUCCESS.PDF',
      }),
    ]);

    expect(importRows).toEqual([
      {
        productCode: 'PDF_ONLY_SUCCESS',
        productDataSheet: 'PDF_ONLY_SUCCESS.PDF',
      },
    ]);
  });

  test('startDownloads writes log and ERP import sheets to xlsx', async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'dad-workbook-test-')
    );
    const sourceImage = path.join(tempRoot, 'source.txt');
    const sourcePdf = path.join(tempRoot, 'source.pdf');
    const imageFolder = path.join(tempRoot, 'images');
    const pdfFolder = path.join(tempRoot, 'pdfs');
    const imageNetworkPath = path.join(tempRoot, 'server-images');

    await fs.writeFile(sourceImage, Buffer.from('image placeholder'));
    await fs.writeFile(sourcePdf, Buffer.from('%PDF-1.4 test'));

    const service = new DownloadService();
    const completion = new Promise<DownloadCompletionEvent>(resolve => {
      service.on('complete', resolve);
    });

    const config: DownloadConfig = {
      excelFile: 'input.xlsx',
      sheetName: 'Sheet1',
      partNoColumn: 'Product Code',
      imageColumns: ['Image URL'],
      pdfColumn: 'PDF URL',
      filenameColumn: '',
      imageFolder,
      pdfFolder,
      sourceImageFolder: '',
      imageFilePath: imageNetworkPath,
      pdfFilePath: path.join(tempRoot, 'server-pdfs'),
      maxWorkers: 2,
      backgroundProcessing: {
        enabled: false,
        method: 'smart_detect',
        quality: 85,
        edgeThreshold: 30,
      },
    };

    await service.startDownloads(config, [
      {
        'Product Code': 'PART1',
        'Image URL': sourceImage,
        'PDF URL': sourcePdf,
      },
    ]);

    const result = await completion;
    expect(result.logFile).toMatch(/DownloadLog_.*\.xlsx$/);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(result.logFile!);

    const logSheet = workbook.getWorksheet('Download Log');
    const importSheet = workbook.getWorksheet('ERP Import');

    expect(logSheet).toBeDefined();
    expect(importSheet).toBeDefined();
    expect(importSheet!.getRow(1).values).toEqual([
      undefined,
      'Product Code',
      'Photo File Path',
      'Product Data Sheet',
    ]);
    expect(importSheet!.getRow(2).values).toEqual([
      undefined,
      'PART1',
      path.join(imageNetworkPath, 'PART1.jpg'),
      'PART1.PDF',
    ]);
  });
});
