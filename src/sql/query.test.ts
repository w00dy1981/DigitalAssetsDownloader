import * as mssql from 'mssql';
import { testSqlConnection } from './connection';
import { runSqlQuery } from './query';

const mockQuery = jest.fn();
const mockInput = jest.fn(() => ({ query: mockQuery }));
const mockClose = jest.fn();
const mockConnect = jest.fn();

jest.mock('mssql', () => ({
  Int: Symbol('Int'),
  ConnectionPool: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    close: mockClose,
  })),
}));

describe('runSqlQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue({
      close: mockClose,
      request: () => ({ input: mockInput, query: mockQuery }),
    });
    mockClose.mockResolvedValue(undefined);
    mockQuery.mockResolvedValue({
      recordset: [
        { PartNo: ' ABC ', ImageUrl: 'https://example.com/image.jpg' },
      ],
    });
  });

  const request = {
    server: 'sql-server',
    database: 'Baker',
    username: 'DigitalAssetsDownloader',
    password: 'secret',
    query: 'SELECT PartNo, ImageUrl FROM Products',
    rowLimit: 50,
    queryTimeoutMs: 30000,
    connectionTimeoutMs: 15000,
  };

  it('normalizes preview rows without mutating external loaded data', async () => {
    const existingLoadedRows = [{ PartNo: 'Existing' }];
    mockQuery
      .mockResolvedValueOnce({ recordset: [{ totalRowCount: '1384' }] })
      .mockResolvedValueOnce({
        recordset: [
          { PartNo: ' ABC ', ImageUrl: 'https://example.com/image.jpg' },
        ],
      });

    const result = await runSqlQuery(request, 'preview');

    expect(result.rows).toEqual([
      { PartNo: 'ABC', ImageUrl: 'https://example.com/image.jpg' },
    ]);
    expect(existingLoadedRows).toEqual([{ PartNo: 'Existing' }]);
    expect(result.rowCount).toBe(1);
    expect(result.totalRowCount).toBe(1384);
    expect(mockInput).toHaveBeenCalledWith('appRowLimit', mssql.Int, 50);
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      `SET ROWCOUNT @appRowLimit;
${request.query}
SET ROWCOUNT 0;`
    );
  });

  it('normalizes full-load rows and returns row count', async () => {
    const result = await runSqlQuery({ ...request, rowLimit: 10000 }, 'load');

    expect(result.columns).toEqual(['PartNo', 'ImageUrl']);
    expect(result.rowCount).toBe(1);
    expect(result.sourceLabel).toBe('sql-server / Baker');
    expect(mockInput).toHaveBeenCalledWith('appRowLimit', mssql.Int, 10000);
  });

  it('enforces the preview cap at the SQL service boundary', async () => {
    await runSqlQuery({ ...request, rowLimit: 10000 }, 'preview');

    expect(mockInput).toHaveBeenCalledWith('appRowLimit', mssql.Int, 50);
  });

  it.each([
    'SELECT PartNo INTO NewProducts FROM Products',
    'SELECT PartNo FROM Products ORDER BY PartNo\nSET NOCOUNT ON',
  ])('rejects invalid queries before opening a connection', async query => {
    await expect(runSqlQuery({ ...request, query }, 'preview')).rejects.toThrow(
      'SQL query rejected'
    );

    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('closes the pool when counting fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('SQL count failed'));

    await expect(runSqlQuery(request, 'preview')).rejects.toThrow(
      'SQL count failed'
    );
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('propagates queryTimeoutMs to the connection config', async () => {
    await testSqlConnection({
      server: 'test-server',
      database: 'TestDB',
      username: 'user',
      password: 'pass',
      queryTimeoutMs: 5000,
      connectionTimeoutMs: 15000,
    });
    const config = jest.mocked(mssql.ConnectionPool).mock.calls[0][0];
    expect(config).toMatchObject({ requestTimeout: 5000 });
  });
});
