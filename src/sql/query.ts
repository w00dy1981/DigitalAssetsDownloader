import { connectSql, safeSqlErrorMessage } from './connection';
import type { SqlQueryRequest, SqlTable } from './contracts';

export async function executeSqlQuery(
  request: SqlQueryRequest
): Promise<SqlTable[]> {
  const pool = await connectSql(request);
  try {
    const { recordsets } = await pool
      .request()
      .query<Record<string, unknown>>(request.query);
    return recordsets.map(table => ({
      columns: Object.values(table.columns)
        .sort((a, b) => a.index - b.index)
        .map(column => column.name),
      rows: table.map(row =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            value instanceof Date
              ? value.toISOString()
              : String(value ?? '').trim(),
          ])
        )
      ),
    }));
  } catch (error) {
    const message = safeSqlErrorMessage(error);
    console.error('SQL query execution failed', message);
    throw new Error(message);
  } finally {
    await pool.close();
  }
}
