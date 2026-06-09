import * as sql from 'mssql';
import {
  SqlConnectionTestRequest,
  SqlConnectionDetails,
  SqlLoadRequest,
  SqlPreviewRequest,
  SqlQueryRequest,
  SqlQueryResult,
} from '@/shared/types';
import { logger } from './LoggingService';
import { CONSTANTS } from '@/shared/constants';
import { stripSqlComments } from '@/shared/sqlUtils';
export { stripSqlComments };

const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\binsert\b/i, label: 'INSERT' },
  { pattern: /\bupdate\b/i, label: 'UPDATE' },
  { pattern: /\bdelete\b/i, label: 'DELETE' },
  { pattern: /\bmerge\b/i, label: 'MERGE' },
  { pattern: /\bdrop\b/i, label: 'DROP' },
  { pattern: /\balter\b/i, label: 'ALTER' },
  { pattern: /\bcreate\b/i, label: 'CREATE' },
  { pattern: /\btruncate\b/i, label: 'TRUNCATE' },
  { pattern: /\bexec\b/i, label: 'EXEC' },
  { pattern: /\bexecute\b/i, label: 'EXECUTE' },
  { pattern: /\bgrant\b/i, label: 'GRANT' },
  { pattern: /\brevoke\b/i, label: 'REVOKE' },
  { pattern: /\bbackup\b/i, label: 'BACKUP' },
  { pattern: /\brestore\b/i, label: 'RESTORE' },
  { pattern: /\bselect\s+[\s\S]*?\binto\b/i, label: 'SELECT INTO' },
  { pattern: /\binto\b/i, label: 'INTO' },
  { pattern: /\bopenrowset\b/i, label: 'OPENROWSET' },
  { pattern: /\bopendatasource\b/i, label: 'OPENDATASOURCE' },
  { pattern: /\bbulk\b/i, label: 'BULK' },
  { pattern: /\bxp_[a-z0-9_]*\b/i, label: 'xp_' },
  { pattern: /\bsp_[a-z0-9_]*\b/i, label: 'sp_' },
];

export interface SqlValidationResult {
  isValid: boolean;
  errors: string[];
}

export function redactSqlRequest<T extends Partial<SqlQueryRequest>>(
  request: T
): Omit<T, 'password'> & { password?: string } {
  const rest = { ...request };
  delete rest.password;
  return { ...rest, password: '[REDACTED]' };
}

export function validateSqlQuery(
  query: string,
  allowedCrossDatabases: string[] = []
): SqlValidationResult {
  const errors: string[] = [];
  const raw = typeof query === 'string' ? query : '';

  if (!raw.trim()) {
    return { isValid: false, errors: ['SQL query is required'] };
  }

  // Strip comments before all validation so SSMS-pasted queries work safely.
  // Dangerous SQL hidden inside comments is removed and never executed.
  const strippedQuery = stripSqlComments(raw);

  if (!strippedQuery) {
    return { isValid: false, errors: ['SQL query is required'] };
  }

  if (strippedQuery.includes(';')) {
    errors.push('Semicolon-separated SQL batches are not allowed');
  }

  if (!/^(select|with)\b/i.test(strippedQuery)) {
    errors.push('Only SELECT queries are allowed');
  }

  for (const { pattern, label } of DANGEROUS_PATTERNS) {
    if (pattern.test(strippedQuery)) {
      errors.push(`${label} is not allowed`);
    }
  }

  // Cross-database allow-list: if non-empty, only listed databases may appear
  // in three-part names such as WebScrapes.dbo.table or [WebScrapes].dbo.table
  if (allowedCrossDatabases.length > 0) {
    const crossDbPattern = /\[?(\w+)\]?\.\w+\.\w+/gi;
    let match: RegExpExecArray | null;
    while ((match = crossDbPattern.exec(strippedQuery)) !== null) {
      const dbName = match[1];
      if (
        !allowedCrossDatabases.some(
          a => a.toLowerCase() === dbName.toLowerCase()
        )
      ) {
        errors.push(
          `Cross-database reference to '${dbName}' is not allowed. Allowed databases: ${allowedCrossDatabases.join(', ')}`
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function applySqlRowLimit(query: string, rowLimit: number): string {
  const trimmedQuery = query.trim().replace(/;+\s*$/, '');
  const normalizedLimit = Math.max(1, Math.floor(rowLimit));

  if (/\bselect\s+(distinct\s+)?top\s*[\d(]/i.test(trimmedQuery)) {
    return trimmedQuery;
  }

  if (/^select\s+distinct\b/i.test(trimmedQuery)) {
    return trimmedQuery.replace(
      /^select\s+distinct\b/i,
      `SELECT DISTINCT TOP (${normalizedLimit})`
    );
  }

  if (/^select\b/i.test(trimmedQuery)) {
    return trimmedQuery.replace(
      /^select\b/i,
      `SELECT TOP (${normalizedLimit})`
    );
  }

  if (/^with\b/i.test(trimmedQuery)) {
    const selectMatches = [...trimmedQuery.matchAll(/\bselect\b/gi)];
    const finalSelect = selectMatches[selectMatches.length - 1];
    if (finalSelect?.index !== undefined) {
      return `${trimmedQuery.slice(0, finalSelect.index)}SELECT TOP (${normalizedLimit})${trimmedQuery.slice(finalSelect.index + 'select'.length)}`;
    }
  }

  return `SELECT TOP (${normalizedLimit}) * FROM (${trimmedQuery}) AS sql_limited_result`;
}

export class SqlServerService {
  async testConnection(
    request: SqlConnectionTestRequest
  ): Promise<{ success: true }> {
    const pool = await this.createConnectionPool(request);
    try {
      await pool.request().query('SELECT 1 AS connection_test');
      return { success: true };
    } finally {
      await pool.close();
    }
  }

  async previewQuery(request: SqlPreviewRequest): Promise<SqlQueryResult> {
    return this.executeQuery(request);
  }

  async loadQueryData(request: SqlLoadRequest): Promise<SqlQueryResult> {
    return this.executeQuery(request);
  }

  getSafeConnectionDetails(
    request: SqlConnectionDetails
  ): SqlConnectionDetails {
    return {
      server: request.server.trim(),
      database: request.database.trim(),
      username: request.username.trim(),
    };
  }

  private async executeQuery(
    request: SqlQueryRequest
  ): Promise<SqlQueryResult> {
    this.validateRequest(request);
    const safeQuery = stripSqlComments(request.query);
    const limitedQuery = applySqlRowLimit(
      safeQuery,
      request.rowLimit || CONSTANTS.SQL.PREVIEW_ROW_LIMIT
    );

    const pool = await this.createConnectionPool(request);
    try {
      const result = await pool.request().query(limitedQuery);
      const rows = (result.recordset || []).map(row => this.normalizeRow(row));
      const columns = this.extractColumns(result.recordset?.columns, rows);

      return {
        columns,
        rows,
        rowCount: rows.length,
        sourceLabel: `${request.server.trim()} / ${request.database.trim()}`,
      };
    } catch (error) {
      const safeMessage = this.safeSqlErrorMessage(error);
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

  private validateRequest(request: SqlQueryRequest): void {
    this.validateConnectionRequest(request);

    const validation = validateSqlQuery(
      request.query,
      request.allowedCrossDatabases
    );
    if (!validation.isValid) {
      throw new Error(`SQL query rejected: ${validation.errors.join(', ')}`);
    }
  }

  private validateConnectionRequest(
    request: SqlConnectionDetails & { password?: string }
  ): void {
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

  private async createConnectionPool(
    request: SqlConnectionDetails & {
      password: string;
      queryTimeoutMs?: number;
      connectionTimeoutMs?: number;
    }
  ): Promise<sql.ConnectionPool> {
    this.validateConnectionRequest(request);

    const config: sql.config = {
      server: request.server.trim(),
      database: request.database.trim(),
      user: request.username.trim(),
      password: request.password,
      connectionTimeout:
        request.connectionTimeoutMs || CONSTANTS.SQL.CONNECTION_TIMEOUT_MS,
      requestTimeout: request.queryTimeoutMs || CONSTANTS.SQL.QUERY_TIMEOUT_MS,
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
      const safeMessage = this.safeSqlErrorMessage(error);
      logger.error(
        'SQL connection failed',
        new Error(safeMessage),
        'SqlServerService'
      );
      throw new Error(safeMessage);
    }
  }

  private extractColumns(
    columnMetadata:
      | Record<string, { name?: string; index?: number }>
      | undefined,
    rows: Record<string, any>[]
  ): string[] {
    if (columnMetadata) {
      return Object.values(columnMetadata)
        .sort((left, right) => (left.index || 0) - (right.index || 0))
        .map(column => column.name || '')
        .filter(Boolean);
    }

    return rows.length > 0 ? Object.keys(rows[0]) : [];
  }

  private normalizeRow(row: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = {};
    Object.entries(row).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        normalized[key] = '';
      } else if (value instanceof Date) {
        normalized[key] = value.toISOString();
      } else {
        normalized[key] = String(value).trim();
      }
    });
    return normalized;
  }

  private safeSqlErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    if (!message) {
      return 'SQL operation failed';
    }

    return message
      .replace(/password\s*=\s*[^;,\s]+/gi, 'password=[REDACTED]')
      .replace(/pwd\s*=\s*[^;,\s]+/gi, 'pwd=[REDACTED]');
  }
}
