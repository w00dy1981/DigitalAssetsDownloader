import { parseEnv } from 'node:util';
import * as fs from 'fs';
import * as path from 'path';
import { testSqlConnection } from './connection';
import { executeSqlQuery } from './query';

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

  it('loads the configured query', async () => {
    const [table] = await executeSqlQuery({ ...base, query: SQL_QUERY });
    expect(table.columns.length).toBeGreaterThan(0);
  });

  it.each([
    [
      'a batch with quoted identifiers, strings, comments and a terminating semicolon',
      `DECLARE @items TABLE (id int);
INSERT INTO @items VALUES (1), (2), (3);
-- SELECT 'this is a comment;'
SELECT id AS PartNo, 'update; -- /*still text*/' AS [drop]
FROM @items /* delete */ ORDER BY id DESC; SELECT 99 AS Ignored;`,
      ['3', '2', '1'],
    ],
    [
      'a CTE with DISTINCT and a nested SELECT',
      `WITH Products AS (SELECT PartNo FROM (VALUES (1), (2), (2), (3)) p(PartNo))
SELECT DISTINCT PartNo, (SELECT ' SELECT ' AS label) AS Label
FROM Products ORDER BY PartNo DESC`,
      ['3', '2', '1'],
    ],
    [
      'a set operation',
      'SELECT 1 AS PartNo UNION ALL SELECT 3 UNION ALL SELECT 2 ORDER BY PartNo DESC',
      ['3', '2', '1'],
    ],
    [
      'a query with OFFSET and FETCH',
      `SELECT PartNo FROM (VALUES (1), (2), (3), (4), (5)) p(PartNo)
ORDER BY PartNo OFFSET 1 ROWS FETCH NEXT 3 ROWS ONLY`,
      ['2', '3', '4'],
    ],
    [
      'a query with TOP WITH TIES',
      `SELECT TOP (2) WITH TIES PartNo FROM (VALUES (1), (2), (2), (3)) p(PartNo)
ORDER BY PartNo`,
      ['1', '2', '2'],
    ],
  ])('reads %s', async (_, query, partNumbers) => {
    const [result] = await executeSqlQuery({ ...base, query });
    expect(result.rows.map(row => row.PartNo)).toEqual(partNumbers);
  });

  it('reports SQL Server errors after an initial result', async () => {
    const query = "SELECT 1 AS PartNo; THROW 51000, 'Fixture query failed', 1;";
    await expect(executeSqlQuery({ ...base, query })).rejects.toThrow(
      'Fixture query failed'
    );
  });

  it('honours the query timeout', async () => {
    await expect(
      executeSqlQuery({
        ...base,
        query: "WAITFOR DELAY '00:00:02'; SELECT 1 AS PartNo;",
        queryTimeoutMs: 250,
      })
    ).rejects.toThrow(/timeout/i);
  });

  it('preserves columns for empty results', async () => {
    const [result] = await executeSqlQuery({
      ...base,
      query: 'SELECT 1 AS PartNo WHERE 1 = 0',
    });

    expect(result).toMatchObject({
      columns: ['PartNo'],
      rows: [],
    });
  });

  it('returns every row and the result after it', async () => {
    const query = `WITH Digits AS (SELECT Digit FROM (VALUES
      (0),(1),(2),(3),(4),(5),(6),(7),(8),(9)) d(Digit))
SELECT TOP (10002) a.Digit + 10 * b.Digit + 100 * c.Digit +
  1000 * d.Digit + 10000 * e.Digit AS PartNo
FROM Digits a CROSS JOIN Digits b CROSS JOIN Digits c
CROSS JOIN Digits d CROSS JOIN Digits e ORDER BY PartNo`;

    const [first, second] = await executeSqlQuery({
      ...base,
      query: query + '; SELECT 42 AS Answer;',
      queryTimeoutMs: 0,
    });
    expect(first.rows).toHaveLength(10002);
    expect(first.rows[10001]).toEqual({ PartNo: '10001' });
    expect(second).toEqual({ columns: ['Answer'], rows: [{ Answer: '42' }] });
  });
});
