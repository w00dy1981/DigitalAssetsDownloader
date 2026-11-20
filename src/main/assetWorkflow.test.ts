import { ipcMain } from 'electron';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DownloadService } from '@/download/downloadRun';
import * as sql from '@/sql/query';
import type { SqlQueryResult } from '@/sql/contracts';
import { IPC_CHANNELS, type DownloadConfig } from '@/shared/types';
import { defaultUserSettings } from '@/shared/userSettings';
import { registerAssetWorkflow } from './assetWorkflow';

jest.mock('electron', () => ({ ipcMain: { handle: jest.fn() } }));

function invoke(channel: string, ...args: unknown[]) {
  const handler = jest
    .mocked(ipcMain.handle)
    .mock.calls.find(
      ([registeredChannel]) => registeredChannel === channel
    )?.[1];
  if (!handler) throw new Error(`Missing handler for ${channel}`);
  return Reflect.apply(handler, undefined, [undefined, ...args]);
}

const sqlRequest = {
  server: 'localhost',
  database: 'Assets',
  username: 'reader',
  password: 'test-password',
  query: 'SELECT Code, Image FROM Products',
  rowLimit: 1,
};
const sqlResult: SqlQueryResult = {
  columns: ['Code', 'Image'],
  rows: [{ Code: 'SQL', Image: 'sql.png' }],
  rowCount: 1,
  totalRowCount: 2,
  sourceLabel: 'localhost / Assets',
};

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

test('returns summaries, preserves SQL preview rows, and starts only with the matching input', async () => {
  const rememberSqlConnection = jest.fn();
  registerAssetWorkflow(
    { getSettings: () => defaultUserSettings, rememberSqlConnection },
    jest.fn()
  );
  let finishOlderLoad: (result: SqlQueryResult) => void = () => {};
  const start = jest
    .spyOn(DownloadService.prototype, 'startDownloads')
    .mockResolvedValue(undefined);
  jest
    .spyOn(sql, 'runSqlQuery')
    .mockResolvedValueOnce(sqlResult)
    .mockResolvedValueOnce(sqlResult)
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishOlderLoad = resolve;
        })
    )
    .mockRejectedValueOnce(new Error('Connection lost'));

  const folder = await mkdtemp(join(tmpdir(), 'asset-workflow-'));
  try {
    const filePath = join(folder, 'products.csv');
    await writeFile(filePath, 'Code,Image\nFILE,file.png\n');
    const config: DownloadConfig = {
      excelFile: filePath,
      sheetName: 'Sheet1',
      partNoColumn: 'Code',
      imageColumns: ['Image'],
      pdfColumn: '',
      filenameColumn: '',
      imageFolder: folder,
      pdfFolder: '',
      sourceImageFolder: '',
      imageFilePath: '',
      maxWorkers: 1,
      backgroundProcessing: {
        enabled: false,
        quality: 90,
      },
    };
    expect(await invoke(IPC_CHANNELS.PREVIEW_SQL_QUERY, sqlRequest)).toEqual(
      sqlResult
    );
    const sqlInput = await invoke(IPC_CHANNELS.LOAD_SQL_QUERY_DATA, sqlRequest);
    expect(sqlInput).toEqual({
      loadId: expect.any(Number),
      columns: sqlResult.columns,
      rowCount: 1,
      sheetName: 'SQL Query',
      filePath: sqlResult.sourceLabel,
      sourceType: 'sql',
      sourceLabel: sqlResult.sourceLabel,
    });
    const olderLoad = invoke(IPC_CHANNELS.LOAD_SQL_QUERY_DATA, sqlRequest);
    const fileInput = await invoke(
      IPC_CHANNELS.LOAD_SHEET_DATA,
      filePath,
      'Sheet1'
    );
    expect(fileInput).toEqual({
      loadId: expect.any(Number),
      columns: ['Code', 'Image'],
      rowCount: 1,
      sheetName: 'Sheet1',
      filePath,
      sourceType: 'file',
      sourceLabel: filePath,
    });
    finishOlderLoad(sqlResult);
    await expect(olderLoad).rejects.toThrow('A newer input load');
    expect(rememberSqlConnection).toHaveBeenCalledTimes(2);

    await expect(
      invoke(IPC_CHANNELS.START_DOWNLOADS, config, sqlInput.loadId)
    ).rejects.toThrow('Please map the columns again');
    expect(start).not.toHaveBeenCalled();
    await expect(
      invoke(IPC_CHANNELS.LOAD_SQL_QUERY_DATA, sqlRequest)
    ).rejects.toThrow('Connection lost');
    await invoke(IPC_CHANNELS.START_DOWNLOADS, config, fileInput.loadId);
    expect(start).toHaveBeenCalledWith(
      config,
      [{ Code: 'FILE', Image: 'file.png' }],
      defaultUserSettings.downloadBehavior
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
