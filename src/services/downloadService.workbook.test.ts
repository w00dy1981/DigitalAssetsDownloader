import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { createServer } from 'http';
import ExcelJS from 'exceljs';
import { Jimp } from 'jimp';
import { DownloadService } from './downloadService';
import { DownloadCompletionEvent, DownloadConfig } from '@/shared/types';

describe('saved downloads and workbook', () => {
  let root: string;
  let config: DownloadConfig;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'dad-download-'));
    config = {
      excelFile: 'input.xlsx',
      sheetName: 'Sheet1',
      partNoColumn: 'Code',
      imageColumns: ['Image', 'Backup'],
      pdfColumn: 'PDF',
      filenameColumn: 'Filename',
      imageFolder: path.join(root, 'images'),
      pdfFolder: path.join(root, 'pdfs'),
      sourceImageFolder: '',
      imageFilePath: path.join(root, 'server-images'),
      pdfFilePath: path.join(root, 'server-pdfs'),
      maxWorkers: 3,
      backgroundProcessing: {
        enabled: false,
        method: 'smart_detect',
        quality: 85,
        edgeThreshold: 30,
      },
    };
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  async function download(rows: Record<string, string>[]) {
    const service = new DownloadService();
    const complete = new Promise<DownloadCompletionEvent>(resolve => {
      service.once('complete', resolve);
    });
    await service.startDownloads(config, rows);
    const result = await complete;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(result.logFile!);
    return { result, workbook };
  }

  async function makeImage(name: string, color: number) {
    const file = path.join(root, name + '.png');
    const image = new Jimp({ width: 8, height: 8, color });
    await fs.writeFile(file, await image.getBuffer('image/png'));
    return file;
  }

  test('sanitised and case-insensitive filename collisions keep each saved asset', async () => {
    const red = await makeImage('red', 0xff0000ff);
    const blue = await makeImage('blue', 0x0000ffff);
    const { workbook } = await download([
      { Code: 'ITEM-1', Image: red },
      { Code: 'ITEM/1', Image: blue },
      { Code: 'item1', Image: red },
    ]);

    const log = workbook.getWorksheet('Download Log')!;
    const files = [2, 3, 4].map(row => log.getRow(row).getCell(9).text);
    expect(new Set(files.map(file => file.toLowerCase())).size).toBe(3);
    const images = await Promise.all(files.map(file => Jimp.read(file)));
    expect(images[0].getPixelColor(0, 0)).toBe(images[2].getPixelColor(0, 0));
    expect(images[0].getPixelColor(0, 0)).not.toBe(
      images[1].getPixelColor(0, 0)
    );
  });

  test('a successful first image source is the only source requested', async () => {
    const red = await fs.readFile(await makeImage('red', 0xff0000ff));
    const requests: string[] = [];
    const server = createServer((request, response) => {
      requests.push(request.url ?? '');
      response.writeHead(200, { 'Content-Type': 'image/png' });
      response.end(red);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string')
        throw new Error('No test server port');
      const url = `http://127.0.0.1:${address.port}`;
      const { result, workbook } = await download([
        { Code: 'ONE', Image: url + '/first', Backup: url + '/backup' },
      ]);
      expect(requests).toEqual(['/first']);
      expect(result).toMatchObject({ successful: 1, failed: 0, total: 1 });
      expect(workbook.getWorksheet('Download Log')!.getCell('C2').text).toBe(
        url + '/first'
      );
      const saved = await fs.readFile(path.join(config.imageFolder, 'ONE.jpg'));
      expect(saved.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve()))
      );
    }
  });

  test('failed image sources fall back and source-folder matches take priority', async () => {
    const red = await makeImage('red', 0xff0000ff);
    const sourceFolder = path.join(root, 'source-images');
    await fs.mkdir(sourceFolder);
    await fs.copyFile(red, path.join(sourceFolder, 'custom.png'));
    config.sourceImageFolder = sourceFolder;
    config.imageFilePath = '\\\\server\\images';
    const invalid = path.join(root, 'invalid.png');
    await fs.writeFile(invalid, '<html>Image not found</html>');

    const { result, workbook } = await download([
      { Code: 'LOCAL', Filename: 'custom.png', Image: invalid },
      { Code: 'FALLBACK', Image: invalid, Backup: red },
    ]);

    expect(result).toMatchObject({ successful: 2, failed: 0, total: 2 });
    const log = workbook.getWorksheet('Download Log')!;
    expect(log.getCell('C2').text).toBe(path.join(sourceFolder, 'custom.png'));
    expect(log.getCell('C3').text).toBe(red);
    expect(await fs.readFile(log.getCell('I3').text)).toEqual(
      await fs.readFile(log.getCell('I2').text)
    );
    const erp = workbook.getWorksheet('ERP Import')!;
    expect(erp.getRow(1).values).toEqual([
      undefined,
      'Product Code',
      'Photo File Path',
    ]);
    expect(erp.getCell('B3').text).toBe(
      config.imageFilePath + '\\FALLBACK.jpg'
    );
  });

  test('cancellation drains the active run and keeps saved results in a readable workbook', async () => {
    const red = await makeImage('red', 0xff0000ff);
    let requestStarted: () => void = () => {};
    const started = new Promise<void>(resolve => {
      requestStarted = resolve;
    });
    const server = createServer(() => requestStarted());
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string')
        throw new Error('No test server port');
      const service = new DownloadService();
      const completions: DownloadCompletionEvent[] = [];
      service.on('complete', result => completions.push(result));
      const run = service.startDownloads({ ...config, maxWorkers: 1 }, [
        { Code: 'DONE', Image: red },
        {
          Code: 'ACTIVE',
          Image: `http://127.0.0.1:${address.port}/slow`,
          Backup: red,
        },
        { Code: 'WAITING', Image: red },
      ]);
      await started;
      service.cancelDownloads();
      await expect(service.startDownloads(config, [])).rejects.toThrow(
        'already in progress'
      );
      await run;

      expect(completions).toHaveLength(1);
      expect(completions[0]).toMatchObject({
        successful: 1,
        failed: 0,
        total: 3,
        cancelled: true,
      });
      expect(
        (await fs.readdir(config.imageFolder)).filter(
          name => !name.endsWith('.xlsx')
        )
      ).toEqual(['DONE.jpg']);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(completions[0].logFile!);
      expect(workbook.getWorksheet('Download Log')!.rowCount).toBe(2);
      await service.startDownloads(config, [{ Code: 'AFTER', Image: red }]);
      expect(completions[1]).toMatchObject({ successful: 1, cancelled: false });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve()))
      );
    }
  });

  test('a failed image cannot replace the PDF with a source-folder image', async () => {
    const red = await makeImage('MIXED', 0xff0000ff);
    config.sourceImageFolder = root;
    const invalid = path.join(root, 'invalid.png');
    await fs.writeFile(invalid, '<html>Image not found</html>');
    const pdf = path.join(root, 'source.pdf');
    const bytes = Buffer.from('%PDF-1.4 test');
    await fs.writeFile(pdf, bytes);
    const { workbook } = await download([
      { Code: 'MIXED', Image: red, PDF: pdf },
      { Code: 'FAILED', Image: invalid, PDF: pdf },
    ]);

    expect(await fs.readFile(path.join(config.pdfFolder, 'MIXED.pdf'))).toEqual(
      bytes
    );
    const erp = workbook.getWorksheet('ERP Import')!;
    expect(erp.getRow(1).values).toEqual([
      undefined,
      'Product Code',
      'Photo File Path',
      'Product Data Sheet',
    ]);
    expect(erp.getCell('B2').text).toBe(
      path.join(config.imageFilePath, 'MIXED.jpg')
    );
    expect(erp.getCell('B3').text).toBe('');
    expect(erp.getCell('C3').text).toBe('FAILED.pdf');
    expect(workbook.getWorksheet('Download Log')!.getCell('D3').text).toBe(
      'Failure'
    );
  });

  test('an original WebP keeps its format in the saved file and workbook', async () => {
    const source = path.join(root, 'source.webp');
    const bytes = Buffer.from(
      'UklGRhwAAABXRUJQVlA4TA8AAAAvAAAAAAcQ/Y/+ByKi/wEA',
      'base64'
    );
    await fs.writeFile(source, bytes);
    const { workbook } = await download([{ Code: 'WEB', Image: source }]);

    const saved = path.join(config.imageFolder, 'WEB.webp');
    expect(await fs.readFile(saved)).toEqual(bytes);
    expect(workbook.getWorksheet('Download Log')!.getCell('I2').text).toBe(
      saved
    );
    expect(workbook.getWorksheet('ERP Import')!.getCell('B2').text).toBe(
      path.join(config.imageFilePath, 'WEB.webp')
    );
  });

  test('both workbook sheets use the exact saved PDF filename', async () => {
    const pdf = path.join(root, 'source.pdf');
    const bytes = Buffer.from('%PDF-1.4 test');
    await fs.writeFile(pdf, bytes);
    const { workbook } = await download([{ Code: 'PDF/1', PDF: pdf }]);

    const log = workbook.getWorksheet('Download Log')!;
    const imported = workbook.getWorksheet('ERP Import')!;
    const saved = log.getCell('I2').text;
    expect(await fs.readFile(saved)).toEqual(bytes);
    expect(log.getCell('K2').text).toBe(path.basename(saved));
    expect(imported.getRow(1).values).toEqual([
      undefined,
      'Product Code',
      'Product Data Sheet',
    ]);
    expect(imported.getRow(2).values).toEqual([
      undefined,
      'PDF/1',
      path.basename(saved),
    ]);
  });
});
