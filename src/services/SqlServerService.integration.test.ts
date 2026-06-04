import * as fs from 'fs';
import * as path from 'path';
import { SqlServerService } from './SqlServerService';

jest.mock('./LoggingService', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

function loadEnvFile(filePath: string): Record<string, string> {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return Object.fromEntries(
      content
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => {
          const eq = line.indexOf('=');
          if (eq === -1) return null;
          const val = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
          return [line.slice(0, eq).trim(), val];
        })
        .filter((e): e is [string, string] => e !== null && e[0] !== '')
    );
  } catch {
    return {};
  }
}

const creds = loadEnvFile(path.resolve(process.cwd(), '.env.test.local'));

const SQL_SERVER = creds.TEST_SQL_SERVER;
const SQL_DATABASE = creds.TEST_SQL_DATABASE;
const SQL_USERNAME = creds.TEST_SQL_USERNAME;
const SQL_PASSWORD = creds.TEST_SQL_PASSWORD;
const SQL_QUERY = creds.TEST_SQL_QUERY || 'SELECT TOP 1 1 AS test_col';

const PLACEHOLDER = 'your-password-here';
const hasCreds = !!(
  SQL_SERVER && SQL_SERVER !== 'your-server-name' &&
  SQL_PASSWORD && SQL_PASSWORD !== PLACEHOLDER
);

const describeIf = hasCreds ? describe : describe.skip;

describeIf('SqlServerService integration (requires live SQL Server)', () => {
  let service: SqlServerService;

  beforeEach(() => {
    service = new SqlServerService();
  });

  const base = {
    server: SQL_SERVER,
    database: SQL_DATABASE,
    username: SQL_USERNAME,
    password: SQL_PASSWORD,
    queryTimeoutMs: 10000,
    connectionTimeoutMs: 15000,
  };

  it('testConnection succeeds with valid credentials', async () => {
    const result = await service.testConnection(base);
    expect(result).toEqual({ success: true });
  }, 30000);

  it('testConnection gives clean error on wrong password', async () => {
    const badCreds = { ...base, password: 'wrong-password-intentional-test' };
    await expect(service.testConnection(badCreds)).rejects.toThrow();

    try {
      await service.testConnection(badCreds);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain('wrong-password-intentional-test');
      expect(message).not.toContain(SQL_PASSWORD);
    }
  }, 30000);

  it('previewQuery returns columns and rows', async () => {
    const result = await service.previewQuery({ ...base, query: SQL_QUERY, rowLimit: 50 });
    expect(result.columns.length).toBeGreaterThan(0);
    expect(Array.isArray(result.rows)).toBe(true);
    expect(result.rowCount).toBeGreaterThanOrEqual(0);
    expect(result.sourceLabel).toContain(SQL_SERVER);
  }, 30000);

  it('loadQueryData returns sourceLabel and row count', async () => {
    const result = await service.loadQueryData({ ...base, query: SQL_QUERY, rowLimit: 10000 });
    expect(result.columns.length).toBeGreaterThan(0);
    expect(result.sourceLabel).toBe(`${SQL_SERVER} / ${SQL_DATABASE}`);
    expect(result.rowCount).toBeGreaterThanOrEqual(0);
  }, 60000);
});
