import { ipcMain } from 'electron';
import { DownloadService } from '@/download/downloadRun';
import { getSheetNames, loadSheetData } from '@/input/spreadsheet';
import { testSqlConnection } from '@/sql/connection';
import type { SqlConnectionRequest, SqlQueryRequest } from '@/sql/contracts';
import { runSqlQuery } from '@/sql/query';
import { downloadConfigErrors } from '@/shared/downloadSettings';
import {
  IPC_CHANNELS,
  type LoadedInput,
  type DownloadConfig,
} from '@/shared/types';
import type {
  DownloadCompletionEvent,
  DownloadProgress,
} from '@/download/downloadRun';
import type { DesktopConfiguration } from './configuration';

export function registerAssetWorkflow(
  configuration: Pick<
    DesktopConfiguration,
    'getSettings' | 'rememberSqlConnection'
  >,
  send: (
    channel: string,
    payload: DownloadProgress | DownloadCompletionEvent
  ) => void
) {
  const downloads = new DownloadService();
  type Rows = readonly Record<string, unknown>[];
  let latestLoadId = 0;
  let loadedInput: { loadId: number; rows: Rows } | undefined;

  async function loadInput(
    read: () => Promise<{
      rows: Rows;
      summary: Omit<LoadedInput, 'loadId' | 'rowCount'>;
    }>,
    rememberConnection?: () => void
  ): Promise<LoadedInput> {
    const loadId = ++latestLoadId;
    const { rows, summary } = await read();
    if (loadId !== latestLoadId) {
      throw new Error('A newer input load replaced this request.');
    }
    rememberConnection?.();
    loadedInput = { loadId, rows };
    return { ...summary, loadId, rowCount: rows.length };
  }

  ipcMain.handle(IPC_CHANNELS.GET_SHEET_NAMES, (_, filePath: string) =>
    getSheetNames(filePath)
  );
  ipcMain.handle(
    IPC_CHANNELS.LOAD_SHEET_DATA,
    (_, filePath: string, sheetName: string) =>
      loadInput(async () => {
        const { columns, rows } = await loadSheetData(filePath, sheetName);
        return {
          rows,
          summary: {
            columns,
            sheetName,
            filePath,
            sourceType: 'file',
            sourceLabel: filePath,
          },
        };
      })
  );

  async function withSavedConnection<T>(
    request: SqlConnectionRequest,
    execute: () => Promise<T>
  ): Promise<T> {
    const result = await execute();
    configuration.rememberSqlConnection(request);
    return result;
  }

  ipcMain.handle(
    IPC_CHANNELS.TEST_SQL_CONNECTION,
    (_, request: SqlConnectionRequest) =>
      withSavedConnection(request, () => testSqlConnection(request))
  );

  function query(request: SqlQueryRequest, mode: 'preview' | 'load') {
    return runSqlQuery(
      request,
      mode,
      configuration.getSettings().sqlSettings.allowedCrossDatabases
    );
  }

  ipcMain.handle(
    IPC_CHANNELS.PREVIEW_SQL_QUERY,
    (_, request: SqlQueryRequest) =>
      withSavedConnection(request, () => query(request, 'preview'))
  );
  ipcMain.handle(
    IPC_CHANNELS.LOAD_SQL_QUERY_DATA,
    (_, request: SqlQueryRequest) =>
      loadInput(
        async () => {
          const { columns, rows, sourceLabel } = await query(request, 'load');
          if (!columns.length) {
            throw new Error('The SQL query returned no columns.');
          }
          return {
            rows,
            summary: {
              columns,
              sheetName: 'SQL Query',
              filePath: sourceLabel,
              sourceType: 'sql',
              sourceLabel,
            },
          };
        },
        () => configuration.rememberSqlConnection(request)
      )
  );

  downloads.on('progress', (progress: DownloadProgress) =>
    send(IPC_CHANNELS.DOWNLOAD_PROGRESS, progress)
  );
  downloads.on('complete', (result: DownloadCompletionEvent) =>
    send(IPC_CHANNELS.DOWNLOAD_COMPLETE, result)
  );
  ipcMain.handle(
    IPC_CHANNELS.START_DOWNLOADS,
    async (_, config: DownloadConfig, loadId: number) => {
      if (!loadedInput) {
        throw new Error('No input data loaded. Please load input data first.');
      }
      if (loadId !== loadedInput.loadId) {
        throw new Error('Input data changed. Please map the columns again.');
      }
      const errors = downloadConfigErrors(config);
      if (errors.length) throw new Error(errors.join(', '));

      await downloads.startDownloads(
        config,
        loadedInput.rows,
        configuration.getSettings().downloadBehavior
      );
    }
  );
  ipcMain.handle(IPC_CHANNELS.CANCEL_DOWNLOADS, () =>
    downloads.cancelDownloads()
  );
}
