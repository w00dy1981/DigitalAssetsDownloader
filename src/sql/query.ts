import { Int } from 'mssql';
import { logger } from '@/services/LoggingService';
import { SQL_CONSTANTS } from './constants';
import {
  connectSql,
  safeSqlErrorMessage,
  validateSqlConnection,
} from './connection';
import type { SqlQueryRequest, SqlQueryResult } from './contracts';
import { buildSqlCountQuery } from './countQuery';
import { validateSqlQuery } from './queryPolicy';
import { toSqlQueryResult } from './queryResult';

export async function runSqlQuery(
  request: SqlQueryRequest,
  mode: 'preview' | 'load',
  allowedCrossDatabases: string[] = []
): Promise<SqlQueryResult> {
  validateSqlConnection(request);
  const validation = validateSqlQuery(request.query, allowedCrossDatabases);
  if (!validation.isValid) {
    throw new Error(`SQL query rejected: ${validation.errors.join(', ')}`);
  }

  const countQuery = buildSqlCountQuery(validation);
  const maxRows =
    mode === 'preview'
      ? SQL_CONSTANTS.PREVIEW_ROW_LIMIT
      : SQL_CONSTANTS.FULL_LOAD_ROW_LIMIT;
  const rowLimit = request.rowLimit;
  const limit =
    typeof rowLimit === 'number' && Number.isFinite(rowLimit) && rowLimit !== 0
      ? Math.min(maxRows, Math.max(1, Math.floor(rowLimit)))
      : maxRows;

  const pool = await connectSql(request);
  try {
    const countResult = await pool
      .request()
      .query<{ totalRowCount: unknown }>(countQuery);
    const result = await pool
      .request()
      .input('appRowLimit', Int, limit)
      .query<Record<string, unknown>>(
        `SET ROWCOUNT @appRowLimit;
${validation.query}
SET ROWCOUNT 0;`
      );
    return toSqlQueryResult(
      result.recordset,
      countResult.recordset?.[0]?.totalRowCount,
      request
    );
  } catch (error) {
    const safeMessage = safeSqlErrorMessage(error);
    logger.error(
      'SQL query execution failed',
      new Error(safeMessage),
      'SqlServerService'
    );
    throw new Error(safeMessage);
  } finally {
    await pool.close();
  }
}
