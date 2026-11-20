import type { IRecordSet } from 'mssql';
import type { SqlConnectionDetails, SqlQueryResult } from './contracts';

export function toSqlQueryResult(
  recordset: IRecordSet<Record<string, unknown>> | undefined,
  count: unknown,
  connection: SqlConnectionDetails
): SqlQueryResult {
  const rows = (recordset || []).map(normalizeRow);
  return {
    columns: extractColumns(recordset?.columns, rows),
    rows,
    rowCount: rows.length,
    totalRowCount: extractTotalRowCount(count) ?? rows.length,
    sourceLabel: `${connection.server.trim()} / ${connection.database.trim()}`,
  };
}

function extractTotalRowCount(value: unknown): number | undefined {
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

function extractColumns(
  columnMetadata: Record<string, { name?: string; index?: number }> | undefined,
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

function normalizeRow(row: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : String(value ?? '').trim(),
    ])
  );
}
