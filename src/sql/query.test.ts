import { EventEmitter } from 'node:events';
import * as mssql from 'mssql';
import { testSqlConnection } from './connection';
import { loadSqlRows, previewSqlQuery } from './query';

const mockConnect = jest.fn();
const mockClose = jest.fn();
jest.mock('mssql', () => ({
  ConnectionPool: jest
    .fn()
    .mockImplementation(() => ({ connect: mockConnect })),
}));

const request = {
  server: 'sql-server',
  database: 'Assets',
  username: 'reader',
  password: 'secret',
  query: "SELECT ' update; -- ' AS Note;",
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('preview runs the original query once and counts only its first result set', async () => {
  const sql = Object.assign(new EventEmitter(), {
    query: jest.fn(async () => {
      sql.emit('recordset', { Note: { name: 'Note', index: 0 } });
      for (let i = 0; i < 52; ++i) sql.emit('row', { Note: ' update; -- ' });
      sql.emit('recordset', { Other: { name: 'Other', index: 0 } });
      sql.emit('row', { Other: 1 });
    }),
  });
  mockConnect.mockResolvedValue({ request: () => sql, close: mockClose });

  const result = await previewSqlQuery({ ...request, rowLimit: 10000 });

  expect(sql.query).toHaveBeenCalledTimes(1);
  expect(sql.query).toHaveBeenCalledWith(request.query);
  expect(result).toMatchObject({
    rowCount: 50,
    totalRowCount: 52,
    columns: ['Note'],
  });
  expect(result.rows[0]).toEqual({ Note: 'update; --' });
});

test('load returns server errors even if some rows arrived', async () => {
  const sql = Object.assign(new EventEmitter(), {
    query: jest.fn(async () => {
      sql.emit('recordset', { Note: { name: 'Note', index: 0 } });
      sql.emit('row', { Note: 'first' });
      sql.emit('error', new Error('Permission denied'));
    }),
  });
  mockConnect.mockResolvedValue({ request: () => sql, close: mockClose });
  await expect(loadSqlRows(request)).rejects.toThrow('Permission denied');
  expect(sql.query).toHaveBeenCalledTimes(1);
  expect(mockClose).toHaveBeenCalledTimes(1);
});

test('rejects a blank query before connecting', async () => {
  await expect(previewSqlQuery({ ...request, query: ' ' })).rejects.toThrow(
    'SQL query is required'
  );
  expect(mockConnect).not.toHaveBeenCalled();
});

test('passes connection and query timeouts to the driver', async () => {
  mockConnect.mockResolvedValue({
    request: () => ({ query: jest.fn() }),
    close: mockClose,
  });
  await testSqlConnection({
    ...request,
    queryTimeoutMs: 5000,
    connectionTimeoutMs: 1234,
  });
  expect(jest.mocked(mssql.ConnectionPool).mock.calls[0][0]).toMatchObject({
    requestTimeout: 5000,
    connectionTimeout: 1234,
  });
});

test('redacts a password from a connection failure without attempting a live login', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockConnect.mockRejectedValueOnce(
    new Error('Login failed; password=sample-secret;')
  );
  try {
    await expect(testSqlConnection(request)).rejects.toThrow(
      'password=[REDACTED]'
    );
    expect(log).toHaveBeenCalledWith(
      'SQL connection failed',
      'Login failed; password=[REDACTED];'
    );
  } finally {
    log.mockRestore();
  }
});
