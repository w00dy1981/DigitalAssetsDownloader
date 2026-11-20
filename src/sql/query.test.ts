import * as mssql from 'mssql';
import { testSqlConnection } from './connection';
import { executeSqlQuery } from './query';

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

test('initial rows do not mask an error later in the batch', async () => {
  const query = jest.fn().mockRejectedValue(new Error('Permission denied'));
  mockConnect.mockResolvedValue({
    request: () => ({ query }),
    close: mockClose,
  });
  await expect(executeSqlQuery(request)).rejects.toThrow('Permission denied');
  expect(query).toHaveBeenCalledTimes(1);
  expect(query).toHaveBeenCalledWith(request.query);
  expect(mockClose).toHaveBeenCalledTimes(1);
});

test('passes connection and query timeouts to the driver', async () => {
  mockConnect.mockResolvedValue({
    request: () => ({ query: jest.fn() }),
    close: mockClose,
  });
  await testSqlConnection({
    ...request,
    database: '',
    password: '',
    queryTimeoutMs: 0,
    connectionTimeoutMs: 1234,
  });
  expect(jest.mocked(mssql.ConnectionPool).mock.calls[0][0]).toMatchObject({
    database: undefined,
    password: '',
    requestTimeout: 0,
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
