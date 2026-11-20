import * as sql from 'mssql';
import { logger } from '@/services/LoggingService';
import { SQL_CONSTANTS } from './constants';
import type { SqlConnectionRequest } from './contracts';

export async function testSqlConnection(
  request: SqlConnectionRequest
): Promise<{ success: true }> {
  validateSqlConnection(request);
  const pool = await connectSql(request);
  try {
    await pool.request().query('SELECT 1 AS connection_test');
    return { success: true };
  } finally {
    await pool.close();
  }
}

export function validateSqlConnection(request: SqlConnectionRequest): void {
  if (!request.server?.trim()) {
    throw new Error('SQL Server name is required');
  }

  if (!request.database?.trim()) {
    throw new Error('SQL database is required');
  }

  if (!request.username?.trim()) {
    throw new Error('SQL username is required');
  }

  if (!request.password) {
    throw new Error('SQL password is required');
  }
}

export async function connectSql(
  request: SqlConnectionRequest
): Promise<sql.ConnectionPool> {
  const config: sql.config = {
    server: request.server.trim(),
    database: request.database.trim(),
    user: request.username.trim(),
    password: request.password,
    connectionTimeout:
      request.connectionTimeoutMs || SQL_CONSTANTS.CONNECTION_TIMEOUT_MS,
    requestTimeout: request.queryTimeoutMs || SQL_CONSTANTS.QUERY_TIMEOUT_MS,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      appName: 'DigitalAssetsDownloader',
    },
    pool: {
      max: 1,
      min: 0,
      idleTimeoutMillis: 1000,
    },
  };

  try {
    const pool = new sql.ConnectionPool(config);
    return await pool.connect();
  } catch (error) {
    const safeMessage = safeSqlErrorMessage(error);
    logger.error(
      'SQL connection failed',
      new Error(safeMessage),
      'SqlServerService'
    );
    throw new Error(safeMessage);
  }
}

export function safeSqlErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (!message) {
    return 'SQL operation failed';
  }

  return message
    .replace(/password\s*=\s*[^;,\s]+/gi, 'password=[REDACTED]')
    .replace(/pwd\s*=\s*[^;,\s]+/gi, 'pwd=[REDACTED]');
}
