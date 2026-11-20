import { parseEnv } from 'node:util';
import * as fs from 'fs';
import * as path from 'path';
import { testSqlConnection } from './connection';
import { runSqlQuery } from './query';

const fixture = path.resolve(process.cwd(), '.env.test.local');
const creds = fs.existsSync(fixture)
  ? parseEnv(fs.readFileSync(fixture, 'utf8'))
  : {};

const SQL_SERVER = creds.TEST_SQL_SERVER ?? '';
const SQL_DATABASE = creds.TEST_SQL_DATABASE ?? '';
const SQL_USERNAME = creds.TEST_SQL_USERNAME ?? '';
const SQL_PASSWORD = creds.TEST_SQL_PASSWORD ?? '';
const SQL_QUERY = creds.TEST_SQL_QUERY || 'SELECT TOP 1 1 AS test_col';

const PLACEHOLDER = 'your-password-here';
const hasCreds = !!(
  SQL_SERVER &&
  SQL_SERVER !== 'your-server-name' &&
  SQL_PASSWORD &&
  SQL_PASSWORD !== PLACEHOLDER
);

const describeIf = hasCreds ? describe : describe.skip;

describeIf('SQL Server integration (requires live SQL Server)', () => {
  const base = {
    server: SQL_SERVER,
    database: SQL_DATABASE,
    username: SQL_USERNAME,
    password: SQL_PASSWORD,
    queryTimeoutMs: 10000,
    connectionTimeoutMs: 15000,
  };

  it('testConnection succeeds with valid credentials', async () => {
    const result = await testSqlConnection(base);
    expect(result).toEqual({ success: true });
  }, 30000);

  it('testConnection gives clean error on wrong password', async () => {
    const badCreds = { ...base, password: 'wrong-password-intentional-test' };
    await expect(testSqlConnection(badCreds)).rejects.toThrow();

    try {
      await testSqlConnection(badCreds);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain('wrong-password-intentional-test');
      expect(message).not.toContain(SQL_PASSWORD);
    }
  }, 30000);

  it('previewQuery returns columns and rows', async () => {
    const result = await runSqlQuery(
      {
        ...base,
        query: SQL_QUERY,
        rowLimit: 50,
      },
      'preview'
    );
    expect(result.columns.length).toBeGreaterThan(0);
    expect(Array.isArray(result.rows)).toBe(true);
    expect(result.rowCount).toBeGreaterThanOrEqual(0);
    expect(result.sourceLabel).toContain(SQL_SERVER);
  }, 30000);

  it('loadQueryData returns sourceLabel and row count', async () => {
    const result = await runSqlQuery(
      {
        ...base,
        query: SQL_QUERY,
        rowLimit: 10000,
      },
      'load'
    );
    expect(result.columns.length).toBeGreaterThan(0);
    expect(result.sourceLabel).toBe(`${SQL_SERVER} / ${SQL_DATABASE}`);
    expect(result.rowCount).toBeGreaterThanOrEqual(0);
  }, 60000);

  it.each([
    [
      'a CTE with DISTINCT and a nested SELECT',
      `WITH Products AS (SELECT PartNo FROM (VALUES (1), (2), (2), (3)) p(PartNo))
SELECT DISTINCT PartNo, (SELECT ' SELECT ' AS label) AS Label
FROM Products ORDER BY PartNo DESC`,
      ['3', '2'],
      3,
    ],
    [
      'a set operation',
      'SELECT 1 AS PartNo UNION ALL SELECT 3 UNION ALL SELECT 2 ORDER BY PartNo DESC',
      ['3', '2'],
      3,
    ],
    [
      'a query with OFFSET and FETCH',
      `SELECT PartNo FROM (VALUES (1), (2), (3), (4), (5)) p(PartNo)
ORDER BY PartNo OFFSET 1 ROWS FETCH NEXT 3 ROWS ONLY`,
      ['2', '3'],
      3,
    ],
    [
      'a query with TOP WITH TIES',
      `SELECT TOP (2) WITH TIES PartNo FROM (VALUES (1), (2), (2), (3)) p(PartNo)
ORDER BY PartNo`,
      ['1', '2'],
      3,
    ],
  ])('limits and counts %s', async (_, query, partNumbers, total) => {
    const result = await runSqlQuery(
      { ...base, query, rowLimit: 2 },
      'preview'
    );

    expect(result.rows.map(row => row.PartNo)).toEqual(partNumbers);
    expect(result.rowCount).toBe(2);
    expect(result.totalRowCount).toBe(total);
  });

  it('preserves columns for empty results', async () => {
    const result = await runSqlQuery(
      {
        ...base,
        query: 'SELECT 1 AS PartNo WHERE 1 = 0',
        rowLimit: 2,
      },
      'preview'
    );

    expect(result).toMatchObject({
      columns: ['PartNo'],
      rows: [],
      rowCount: 0,
      totalRowCount: 0,
    });
  });

  it('keeps the preview and load limits distinct from the total count', async () => {
    const query = `WITH Digits AS (SELECT Digit FROM (VALUES
      (0),(1),(2),(3),(4),(5),(6),(7),(8),(9)) d(Digit))
SELECT TOP (10002) a.Digit + 10 * b.Digit + 100 * c.Digit +
  1000 * d.Digit + 10000 * e.Digit AS PartNo
FROM Digits a CROSS JOIN Digits b CROSS JOIN Digits c
CROSS JOIN Digits d CROSS JOIN Digits e ORDER BY PartNo`;

    const preview = await runSqlQuery(
      {
        ...base,
        query,
        rowLimit: 50,
      },
      'preview'
    );
    const loaded = await runSqlQuery(
      {
        ...base,
        query,
        rowLimit: 10000,
      },
      'load'
    );

    expect(preview).toMatchObject({ rowCount: 50, totalRowCount: 10002 });
    expect(loaded).toMatchObject({ rowCount: 10000, totalRowCount: 10002 });
    expect(loaded.rows.slice(0, 50)).toEqual(preview.rows);
    expect(loaded.rows[9999]).toEqual({ PartNo: '9999' });
  });
});
