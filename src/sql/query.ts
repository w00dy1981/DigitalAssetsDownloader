import type { IColumnMetadata } from 'mssql';
import { SQL_CONSTANTS } from './constants';
import {
  connectSql,
  safeSqlErrorMessage,
  validateSqlConnection,
} from './connection';
import type { SqlQueryRequest, SqlQueryResult } from './contracts';

export async function previewSqlQuery(
  request: SqlQueryRequest
): Promise<SqlQueryResult> {
  let extraRows = 0;
  const data = await readSqlRows(
    request,
    SQL_CONSTANTS.PREVIEW_ROW_LIMIT,
    () => extraRows++
  );
  return {
    ...data,
    rowCount: data.rows.length,
    totalRowCount: data.rows.length + extraRows,
  };
}

export function loadSqlRows(request: SqlQueryRequest) {
  return readSqlRows(request, SQL_CONSTANTS.FULL_LOAD_ROW_LIMIT);
}

async function readSqlRows(
  request: SqlQueryRequest,
  maxRows: number,
  countExtraRow?: () => void
) {
  validateSqlConnection(request);
  if (typeof request.query !== 'string' || !request.query.trim()) {
    throw new Error('SQL query is required');
  }
  const rowLimit = request.rowLimit;
  const limit =
    typeof rowLimit === 'number' && Number.isFinite(rowLimit) && rowLimit !== 0
      ? Math.min(maxRows, Math.max(1, Math.floor(rowLimit)))
      : maxRows;

  const pool = await connectSql(request);
  try {
    const sql = pool.request();
    sql.stream = true;
    let columns: string[] | undefined;
    let readingFirstResult = false;
    let stoppedAtLimit = false;
    let queryError: Error | undefined;
    const rows: Record<string, string>[] = [];
    sql.on('recordset', (metadata: IColumnMetadata) => {
      readingFirstResult =
        columns === undefined && Object.keys(metadata).length > 0;
      if (readingFirstResult) {
        columns = Object.values(metadata)
          .sort((a, b) => a.index - b.index)
          .map(column => column.name)
          .filter(Boolean);
      }
    });
    sql.on('row', (row: Record<string, unknown>) => {
      if (!readingFirstResult) return;
      if (rows.length < limit) {
        rows.push(normalizeRow(row));
      } else if (countExtraRow) {
        countExtraRow();
      } else if (!stoppedAtLimit) {
        stoppedAtLimit = true;
        sql.cancel();
      }
    });
    // mssql reports streaming errors as events even when its query promise resolves.
    sql.on('error', (error: Error & { code?: string }) => {
      if (!(stoppedAtLimit && error.code === 'ECANCEL')) queryError ??= error;
    });
    await sql.query(request.query);
    if (queryError) throw queryError;
    return {
      columns: columns ?? [],
      rows,
      sourceLabel: `${request.server.trim()} / ${request.database.trim()}`,
    };
  } catch (error) {
    const safeMessage = safeSqlErrorMessage(error);
    console.error('SQL query execution failed', safeMessage);
    throw new Error(safeMessage);
  } finally {
    await pool.close();
  }
}

function normalizeRow(row: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : String(value ?? '').trim(),
    ])
  );
}
