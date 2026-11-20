import { ipcMain } from 'electron';
import { DownloadService } from '@/download/downloadRun';
import { getSheetNames, loadSheetData } from '@/input/spreadsheet';
import { testSqlConnection } from '@/sql/connection';
import type { SqlConnectionRequest, SqlQueryRequest } from '@/sql/contracts';
import { runSqlQuery } from '@/sql/query';
import { downloadConfigErrors } from '@/shared/downloadSettings';
import { IPC_CHANNELS, type DownloadConfig } from '@/shared/types';
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
  let loadedRows: readonly Record<string, unknown>[] | undefined;

  ipcMain.handle(IPC_CHANNELS.GET_SHEET_NAMES, (_, filePath: string) =>
    getSheetNames(filePath)
  );
  ipcMain.handle(
    IPC_CHANNELS.LOAD_SHEET_DATA,
    async (_, filePath: string, sheetName: string) => {
      const data = await loadSheetData(filePath, sheetName);
      loadedRows = data.rows;
      return data;
    }
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
    return withSavedConnection(request, () =>
      runSqlQuery(
        request,
        mode,
        configuration.getSettings().sqlSettings.allowedCrossDatabases
      )
    );
  }

  ipcMain.handle(
    IPC_CHANNELS.PREVIEW_SQL_QUERY,
    (_, request: SqlQueryRequest) => query(request, 'preview')
  );
  ipcMain.handle(
    IPC_CHANNELS.LOAD_SQL_QUERY_DATA,
    async (_, request: SqlQueryRequest) => {
      const result = await query(request, 'load');
      loadedRows = result.rows;
      return result;
    }
  );

  downloads.on('progress', (progress: DownloadProgress) =>
    send(IPC_CHANNELS.DOWNLOAD_PROGRESS, progress)
  );
  downloads.on('complete', (result: DownloadCompletionEvent) =>
    send(IPC_CHANNELS.DOWNLOAD_COMPLETE, result)
  );
  ipcMain.handle(
    IPC_CHANNELS.START_DOWNLOADS,
    async (_, config: DownloadConfig) => {
      if (!loadedRows) {
        throw new Error(
          'No spreadsheet data loaded. Please load a file first.'
        );
      }
      const errors = downloadConfigErrors(config);
      if (errors.length) throw new Error(errors.join(', '));

      await downloads.startDownloads(
        config,
        loadedRows,
        configuration.getSettings().downloadBehavior
      );
    }
  );
  ipcMain.handle(IPC_CHANNELS.CANCEL_DOWNLOADS, () =>
    downloads.cancelDownloads()
  );
}
