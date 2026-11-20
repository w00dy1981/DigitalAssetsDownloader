import * as sql from 'mssql';
import { defaultUserSettings } from '../shared/userSettings';
import type { SqlConnectionRequest } from './contracts';

export async function testSqlConnection(
  request: SqlConnectionRequest
): Promise<{ success: true }> {
  const pool = await connectSql(request);
  try {
    await pool.request().query('SELECT 1 AS connection_test');
    return { success: true };
  } finally {
    await pool.close();
  }
}

export async function connectSql(
  request: SqlConnectionRequest
): Promise<sql.ConnectionPool> {
  const config: sql.config = {
    server: request.server.trim(),
    database: request.database.trim() || undefined,
    user: request.username.trim(),
    password: request.password,
    connectionTimeout: request.connectionTimeoutMs,
    requestTimeout:
      request.queryTimeoutMs ?? defaultUserSettings.sqlSettings.queryTimeoutMs,
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
    console.error('SQL connection failed', safeMessage);
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
