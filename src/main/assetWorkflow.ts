import { app, ipcMain } from 'electron';
import { join } from 'node:path';
import { DownloadService } from '@/services/downloadService';
import { getSheetNames, loadSheetData } from '@/services/excelService';
import { SqlCredentialService } from '@/services/SqlCredentialService';
import { SqlServerService } from '@/services/SqlServerService';
import { downloadConfigErrors } from '@/shared/downloadSettings';
import {
  IPC_CHANNELS,
  type DownloadCompletionEvent,
  type DownloadConfig,
  type DownloadProgress,
  type SqlConnectionTestRequest,
  type SqlCredentialIdentity,
  type SqlLoadRequest,
  type SqlPasswordDeleteRequest,
  type SqlPasswordSaveRequest,
  type SqlPreviewRequest,
} from '@/shared/types';
import type { DesktopConfiguration } from './configuration';

export function registerAssetWorkflow(
  configuration: Pick<
    DesktopConfiguration,
    'getSettings' | 'recordRecentFile' | 'rememberSqlConnection'
  >,
  send: (
    channel: string,
    payload: DownloadProgress | DownloadCompletionEvent
  ) => void
) {
  const downloads = new DownloadService();
  const sql = new SqlServerService();
  const credentials = new SqlCredentialService(
    join(app.getPath('userData'), 'sql-credentials')
  );
  let loadedRows: readonly Record<string, unknown>[] | undefined;

  ipcMain.handle(IPC_CHANNELS.GET_SHEET_NAMES, (_, filePath: string) =>
    getSheetNames(filePath)
  );
  ipcMain.handle(
    IPC_CHANNELS.LOAD_SHEET_DATA,
    async (_, filePath: string, sheetName: string) => {
      const data = await loadSheetData(filePath, sheetName);
      configuration.recordRecentFile(filePath);
      loadedRows = data.rows;
      return data;
    }
  );

  async function withSavedConnection<T>(
    request: SqlConnectionTestRequest,
    execute: () => Promise<T>
  ): Promise<T> {
    const result = await execute();
    configuration.rememberSqlConnection(sql.getSafeConnectionDetails(request));
    return result;
  }

  ipcMain.handle(
    IPC_CHANNELS.TEST_SQL_CONNECTION,
    (_, request: SqlConnectionTestRequest) =>
      withSavedConnection(request, () => sql.testConnection(request))
  );

  function queryRequest(request: SqlPreviewRequest | SqlLoadRequest) {
    return {
      ...request,
      allowedCrossDatabases:
        configuration.getSettings().sqlSettings.allowedCrossDatabases,
    };
  }

  ipcMain.handle(
    IPC_CHANNELS.PREVIEW_SQL_QUERY,
    (_, request: SqlPreviewRequest) =>
      withSavedConnection(request, () =>
        sql.previewQuery(queryRequest(request))
      )
  );
  ipcMain.handle(
    IPC_CHANNELS.LOAD_SQL_QUERY_DATA,
    async (_, request: SqlLoadRequest) => {
      const result = await withSavedConnection(request, () =>
        sql.loadQueryData(queryRequest(request))
      );
      loadedRows = result.rows;
      return result;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.LOAD_SAVED_SQL_PASSWORD,
    (_, identity: SqlCredentialIdentity) =>
      credentials.loadSavedPassword(identity)
  );
  ipcMain.handle(
    IPC_CHANNELS.SAVE_SQL_PASSWORD,
    (_, request: SqlPasswordSaveRequest) => credentials.savePassword(request)
  );
  ipcMain.handle(
    IPC_CHANNELS.DELETE_SAVED_SQL_PASSWORD,
    (_, request: SqlPasswordDeleteRequest) =>
      credentials.deleteSavedPassword(request)
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
