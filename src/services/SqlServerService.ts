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
import { SQL_CONSTANTS } from '@/shared/constants';

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

export function validateSqlQuery(
  query: string,
  allowedCrossDatabases: string[] = []
): SqlValidationResult {
  return validateReadOnlyQuery(
    typeof query === 'string' ? stripSqlComments(query) : '',
    allowedCrossDatabases
  );
}

function validateReadOnlyQuery(
  strippedQuery: string,
  allowedCrossDatabases: string[] = []
): SqlValidationResult {
  const errors: string[] = [];
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

export function stripSqlComments(query: string): string {
  const tokens =
    /--[^\r\n]*|\/\*|'(?:''|[^'])*'|"(?:""|[^"])*"|\[(?:\]\]|[^\]])*\]/g;
  let cursor = 0;
  let result = '';
  let token: RegExpExecArray | null;

  while ((token = tokens.exec(query)) !== null) {
    if (token[0].startsWith('--')) {
      result += query.slice(cursor, token.index);
      cursor = tokens.lastIndex;
    } else if (token[0] === '/*') {
      result += query.slice(cursor, token.index) + ' ';
      const markers = /\/\*|\*\//g;
      markers.lastIndex = tokens.lastIndex;
      let depth = 1;
      let marker: RegExpExecArray | null;
      while (depth > 0 && (marker = markers.exec(query)) !== null) {
        depth += marker[0] === '/*' ? 1 : -1;
      }
      cursor = depth === 0 ? markers.lastIndex : query.length;
      tokens.lastIndex = cursor;
    }
  }
  return (result + query.slice(cursor)).trim();
}

function topLevelWords(query: string): { word: string; index: number }[] {
  const tokens =
    /'(?:''|[^'])*'|"(?:""|[^"])*"|\[(?:\]\]|[^\]])*\]|[\p{L}\p{N}_@$#]+|[()]/gu;
  const words: { word: string; index: number }[] = [];
  let depth = 0;
  let token: RegExpExecArray | null;

  while ((token = tokens.exec(query)) !== null) {
    const value = token[0];
    if (value === '(') depth++;
    else if (value === ')') depth--;
    else if (depth === 0) {
      words.push({ word: value.toUpperCase(), index: token.index });
    }
  }
  return words;
}

function buildSqlCountQuery(query: string): string {
  const words = topLevelWords(query);
  const select = words.find(token => token.word === 'SELECT');
  if (!select)
    throw new Error('SQL query rejected: Only SELECT queries are allowed');
  if (words.some(token => token.word === 'SET')) {
    throw new Error('SQL query rejected: SET is not allowed');
  }

  const order = words.findIndex(
    (token, index) => token.word === 'ORDER' && words[index + 1]?.word === 'BY'
  );
  // Pagination and ties depend on ORDER BY even when only counting rows.
  const keepOrder =
    words.slice(order + 2).some(token => token.word === 'OFFSET') ||
    words.some(
      (token, index) =>
        token.word === 'WITH' && words[index + 1]?.word === 'TIES'
    );
  const end = order >= 0 && !keepOrder ? words[order].index : query.length;
  const prefix = query.slice(0, select.index);
  const body = query.slice(select.index, end).trimEnd();

  return `${prefix}SELECT COUNT_BIG(1) AS totalRowCount FROM (${body}) AS sql_count_result`;
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
    return this.executeQuery(request, SQL_CONSTANTS.PREVIEW_ROW_LIMIT);
  }

  async loadQueryData(request: SqlLoadRequest): Promise<SqlQueryResult> {
    return this.executeQuery(request, SQL_CONSTANTS.FULL_LOAD_ROW_LIMIT);
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
    request: SqlQueryRequest,
    maxRows: number
  ): Promise<SqlQueryResult> {
    const safeQuery = this.validateRequest(request);
    const countQuery = buildSqlCountQuery(safeQuery);
    const rowLimit = request.rowLimit;
    const limit =
      typeof rowLimit === 'number' &&
      Number.isFinite(rowLimit) &&
      rowLimit !== 0
        ? Math.min(maxRows, Math.max(1, Math.floor(rowLimit)))
        : maxRows;

    const pool = await this.createConnectionPool(request);
    try {
      const countResult = await pool
        .request()
        .query<{ totalRowCount: unknown }>(countQuery);
      const result = await pool
        .request()
        .input('appRowLimit', sql.Int, limit)
        .query<Record<string, unknown>>(
          `SET ROWCOUNT @appRowLimit;
${safeQuery}
SET ROWCOUNT 0;`
        );
      const rows = (result.recordset || []).map(row => this.normalizeRow(row));
      const columns = this.extractColumns(result.recordset?.columns, rows);
      const totalRowCount = this.extractTotalRowCount(
        countResult.recordset?.[0]?.totalRowCount
      );

      return {
        columns,
        rows,
        rowCount: rows.length,
        totalRowCount: totalRowCount ?? rows.length,
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

  private validateRequest(request: SqlQueryRequest): string {
    this.validateConnectionRequest(request);

    const safeQuery =
      typeof request.query === 'string' ? stripSqlComments(request.query) : '';
    const validation = validateReadOnlyQuery(
      safeQuery,
      request.allowedCrossDatabases
    );
    if (!validation.isValid) {
      throw new Error(`SQL query rejected: ${validation.errors.join(', ')}`);
    }
    return safeQuery;
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

  private extractTotalRowCount(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
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
    rows: Record<string, string>[]
  ): string[] {
    if (columnMetadata) {
      return Object.values(columnMetadata)
        .sort((left, right) => (left.index || 0) - (right.index || 0))
        .map(column => column.name || '')
        .filter(Boolean);
    }

    return rows.length > 0 ? Object.keys(rows[0]) : [];
  }

  private normalizeRow(row: Record<string, unknown>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        value instanceof Date
          ? value.toISOString()
          : String(value ?? '').trim(),
      ])
    );
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
