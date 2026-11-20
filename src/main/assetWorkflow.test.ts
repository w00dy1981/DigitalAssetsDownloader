import { ipcMain } from 'electron';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DownloadService, type DownloadOptions } from '@/download/downloadRun';
import * as sql from '@/sql/query';
import type { SqlTable } from '@/sql/contracts';
import { IPC_CHANNELS } from '@/shared/types';
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
};
const sqlResult: SqlTable = {
  columns: ['Code', 'Image'],
  rows: [
    { Code: 'SQL', Image: 'sql.png' },
    { Code: 'Second', Image: 'two.png' },
  ],
};

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

test('returns summaries, preserves SQL preview rows, and starts only with the matching input', async () => {
  const rememberSqlConnection = jest.fn(() => {
    throw new Error('Store is read-only');
  });
  registerAssetWorkflow(
    {
      getSettings: () => ({
        ...defaultUserSettings,
        sqlSettings: {
          ...defaultUserSettings.sqlSettings,
          previewRows: 1,
          queryTimeoutMs: 0,
        },
      }),
      rememberSqlConnection,
    },
    jest.fn()
  );
  let finishOlderLoad: (result: SqlTable[]) => void = () => {};
  const start = jest
    .spyOn(DownloadService.prototype, 'startDownloads')
    .mockResolvedValue(undefined);
  const execute = jest
    .spyOn(sql, 'executeSqlQuery')
    .mockResolvedValueOnce([
      { columns: ['Status'], rows: [{ Status: 'done' }] },
      sqlResult,
    ])
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
    const config: DownloadOptions = {
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
    const { executionId, results, warning } = await invoke(
      IPC_CHANNELS.EXECUTE_SQL_QUERY,
      sqlRequest
    );
    expect(warning).toMatch(/SQL succeeded.*could not be saved/);
    expect(results[1]).toEqual({
      columns: sqlResult.columns,
      rows: [sqlResult.rows[0]],
      totalRowCount: 2,
    });
    expect(execute).toHaveBeenCalledWith({ ...sqlRequest, queryTimeoutMs: 0 });
    const sqlInput = await invoke(
      IPC_CHANNELS.SELECT_SQL_RESULT,
      executionId,
      1
    );
    await invoke(IPC_CHANNELS.START_DOWNLOADS, config, sqlInput.loadId);
    expect(start).toHaveBeenCalledWith(
      config,
      sqlResult.rows,
      defaultUserSettings.downloadBehavior
    );
    start.mockClear();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(sqlInput).toEqual({
      loadId: expect.any(Number),
      columns: sqlResult.columns,
      rowCount: 2,
      sheetName: 'SQL result 2',
      options: expect.objectContaining({ partNoColumn: '', imageColumns: [] }),
      sourceLabel: 'localhost / Assets',
    });
    const olderLoad = invoke(IPC_CHANNELS.EXECUTE_SQL_QUERY, sqlRequest);
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
      options: sqlInput.options,
      sourceLabel: filePath,
    });
    const running = jest
      .spyOn(DownloadService.prototype, 'running', 'get')
      .mockReturnValue(true);
    await expect(
      invoke(IPC_CHANNELS.LOAD_SHEET_DATA, filePath, 'Sheet1')
    ).rejects.toThrow('Finish or cancel');
    running.mockRestore();
    finishOlderLoad([sqlResult]);
    await expect(olderLoad).rejects.toThrow('A newer input load');
    expect(rememberSqlConnection).toHaveBeenCalledTimes(1);
    expect(() =>
      invoke(IPC_CHANNELS.SELECT_SQL_RESULT, executionId, 1)
    ).toThrow('no longer available');

    await expect(
      invoke(IPC_CHANNELS.START_DOWNLOADS, config, sqlInput.loadId)
    ).rejects.toThrow('Please map the columns again');
    expect(start).not.toHaveBeenCalled();
    await expect(
      invoke(IPC_CHANNELS.EXECUTE_SQL_QUERY, sqlRequest)
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
