import { ipcMain } from 'electron';
import { DownloadService } from '@/download/downloadRun';
import { getSheetNames, loadSheetData } from '@/input/spreadsheet';
import { testSqlConnection } from '@/sql/connection';
import type {
  SqlConnectionRequest,
  SqlQueryRequest,
  SqlTable,
  SqlExecution,
} from '@/sql/contracts';
import { executeSqlQuery } from '@/sql/query';
import { initialDownloadOptions } from '@/shared/downloadSettings';
import { IPC_CHANNELS, type LoadedInput } from '@/shared/types';
import type {
  DownloadOptions,
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

  let sqlExecution:
    | { id: number; tables: SqlTable[]; sourceLabel: string }
    | undefined;

  function checkInputCanChange() {
    if (downloads.running)
      throw new Error(
        'Finish or cancel the current download before loading another input.'
      );
  }

  function beginLoad() {
    checkInputCanChange();
    return ++latestLoadId;
  }

  function checkLatestLoad(loadId: number) {
    if (loadId !== latestLoadId)
      throw new Error('A newer input load replaced this request.');
  }

  function useRows(
    loadId: number,
    columns: string[],
    rows: Rows,
    sourceLabel: string,
    sheetName: string
  ): LoadedInput {
    loadedInput = { loadId, rows };
    return {
      loadId,
      columns,
      rowCount: rows.length,
      sourceLabel,
      sheetName,
      options: initialDownloadOptions(configuration.getSettings()),
    };
  }

  ipcMain.handle(IPC_CHANNELS.GET_SHEET_NAMES, (_, filePath: string) =>
    getSheetNames(filePath)
  );
  ipcMain.handle(
    IPC_CHANNELS.LOAD_SHEET_DATA,
    async (_, filePath: string, sheetName: string) => {
      const id = beginLoad();
      const { columns, rows } = await loadSheetData(filePath, sheetName);
      checkLatestLoad(id);
      checkInputCanChange();
      sqlExecution = undefined;
      return useRows(id, columns, rows, filePath, sheetName);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TEST_SQL_CONNECTION,
    async (_, request: SqlConnectionRequest) => {
      const result = await testSqlConnection({
        ...request,
        queryTimeoutMs: configuration.getSettings().sqlSettings.queryTimeoutMs,
      });
      configuration.rememberSqlConnection(request);
      return result;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.EXECUTE_SQL_QUERY,
    async (_, request: SqlQueryRequest): Promise<SqlExecution> => {
      const id = ++latestLoadId;
      const { queryTimeoutMs, previewRows } =
        configuration.getSettings().sqlSettings;
      const tables = await executeSqlQuery({ ...request, queryTimeoutMs });
      checkLatestLoad(id);
      const sourceLabel = [request.server.trim(), request.database.trim()]
        .filter(Boolean)
        .join(' / ');
      sqlExecution = { id, tables, sourceLabel };
      configuration.rememberSqlConnection(request);
      return {
        executionId: id,
        results: tables.map(({ columns, rows }) => ({
          columns,
          rows: rows.slice(0, previewRows),
          totalRowCount: rows.length,
        })),
      };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SELECT_SQL_RESULT,
    (_, executionId: number, index: number) => {
      const table = sqlExecution?.tables[index];
      if (
        !sqlExecution ||
        sqlExecution.id !== executionId ||
        !Number.isInteger(index) ||
        !table
      ) {
        throw new Error('The selected SQL result is no longer available.');
      }
      return useRows(
        beginLoad(),
        table.columns,
        table.rows,
        sqlExecution.sourceLabel,
        `SQL result ${index + 1}`
      );
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
    async (_, config: DownloadOptions, loadId: number) => {
      if (!loadedInput) {
        throw new Error('No input data loaded. Please load input data first.');
      }
      if (loadId !== loadedInput.loadId) {
        throw new Error('Input data changed. Please map the columns again.');
      }

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
