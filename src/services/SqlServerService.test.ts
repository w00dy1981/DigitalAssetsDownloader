import {
  applySqlRowLimit,
  redactSqlRequest,
  SqlServerService,
  validateSqlQuery,
} from './SqlServerService';

const mockQuery = jest.fn();
const mockClose = jest.fn();
const mockConnect = jest.fn();

jest.mock('mssql', () => ({
  ConnectionPool: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    close: mockClose,
    request: () => ({
      query: mockQuery,
    }),
  })),
}));

jest.mock('./LoggingService', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('SqlServerService validation', () => {
  it('allows simple SELECT queries', () => {
    expect(validateSqlQuery('SELECT PartNo, ImageUrl FROM Products')).toEqual({
      isValid: true,
      errors: [],
    });
  });

  it('allows WITH SELECT queries', () => {
    expect(
      validateSqlQuery(
        'WITH ProductRows AS (SELECT PartNo FROM Products) SELECT PartNo FROM ProductRows'
      )
    ).toEqual({ isValid: true, errors: [] });
  });

  it.each([
    'INSERT INTO Products VALUES (1)',
    'UPDATE Products SET Name = 1',
    'DELETE FROM Products',
    'MERGE Products AS target USING Other AS source ON 1 = 1 WHEN MATCHED THEN UPDATE SET Name = 1',
    'DROP TABLE Products',
    'ALTER TABLE Products ADD Name varchar(10)',
    'CREATE TABLE Products (Id int)',
    'TRUNCATE TABLE Products',
    'EXEC dbo.ReadProducts',
    'EXECUTE dbo.ReadProducts',
    'GRANT SELECT ON Products TO user1',
    'REVOKE SELECT ON Products FROM user1',
    'BACKUP DATABASE Baker TO DISK = N"x"',
    'RESTORE DATABASE Baker FROM DISK = N"x"',
    'SELECT * INTO NewProducts FROM Products',
    'SELECT * FROM Products INTO NewProducts',
    'SELECT * FROM OPENROWSET(BULK N"x", SINGLE_BLOB) AS x',
    'SELECT * FROM OPENDATASOURCE("SQLNCLI", "Data Source=x").db.dbo.t',
    'BULK INSERT Products FROM "x"',
    'SELECT * FROM xp_cmdshell',
    'SELECT * FROM sp_help',
    'SELECT * FROM Products; SELECT * FROM Other',
    'SELECT * FROM Products -- comment',
    'SELECT * FROM Products /* comment */',
  ])('rejects unsafe query: %s', query => {
    const result = validateSqlQuery(query);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects non-select queries', () => {
    const result = validateSqlQuery('DECLARE @x int');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Only SELECT queries are allowed');
  });
});

describe('SqlServerService query limiting', () => {
  it('adds TOP to simple SELECT queries', () => {
    expect(applySqlRowLimit('SELECT PartNo FROM Products', 50)).toBe(
      'SELECT TOP (50) PartNo FROM Products'
    );
  });

  it('adds TOP after SELECT DISTINCT', () => {
    expect(applySqlRowLimit('SELECT DISTINCT PartNo FROM Products', 25)).toBe(
      'SELECT DISTINCT TOP (25) PartNo FROM Products'
    );
  });

  it('adds TOP to the final SELECT in a WITH query', () => {
    expect(
      applySqlRowLimit(
        'WITH ProductRows AS (SELECT PartNo FROM Products) SELECT PartNo FROM ProductRows',
        10
      )
    ).toBe(
      'WITH ProductRows AS (SELECT PartNo FROM Products) SELECT TOP (10) PartNo FROM ProductRows'
    );
  });

  it('does not alter queries that already have TOP (n)', () => {
    expect(applySqlRowLimit('SELECT TOP (5) PartNo FROM Products', 50)).toBe(
      'SELECT TOP (5) PartNo FROM Products'
    );
  });

  it('does not alter queries that already have TOP n (no parens)', () => {
    expect(applySqlRowLimit('SELECT TOP 10 * FROM Products', 50)).toBe(
      'SELECT TOP 10 * FROM Products'
    );
  });
});

describe('SqlServerService execution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue({
      close: mockClose,
      request: () => ({
        query: mockQuery,
      }),
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
    const service = new SqlServerService();
    const existingLoadedRows = [{ PartNo: 'Existing' }];

    const result = await service.previewQuery(request);

    expect(result.rows).toEqual([
      { PartNo: 'ABC', ImageUrl: 'https://example.com/image.jpg' },
    ]);
    expect(existingLoadedRows).toEqual([{ PartNo: 'Existing' }]);
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT TOP (50) PartNo, ImageUrl FROM Products'
    );
  });

  it('normalizes full-load rows and returns row count', async () => {
    const service = new SqlServerService();

    const result = await service.loadQueryData({ ...request, rowLimit: 10000 });

    expect(result.columns).toEqual(['PartNo', 'ImageUrl']);
    expect(result.rowCount).toBe(1);
    expect(result.sourceLabel).toBe('sql-server / Baker');
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT TOP (10000) PartNo, ImageUrl FROM Products'
    );
  });

  it('redacts password-bearing requests', () => {
    expect(redactSqlRequest(request)).toEqual({
      server: 'sql-server',
      database: 'Baker',
      username: 'DigitalAssetsDownloader',
      query: 'SELECT PartNo, ImageUrl FROM Products',
      rowLimit: 50,
      queryTimeoutMs: 30000,
      connectionTimeoutMs: 15000,
      password: '[REDACTED]',
    });
  });

  it('propagates queryTimeoutMs to the connection config', async () => {
    const { ConnectionPool } = require('mssql') as jest.Mocked<typeof import('mssql')>;
    const service = new SqlServerService();
    await service.testConnection({
      server: 'test-server',
      database: 'TestDB',
      username: 'user',
      password: 'pass',
      queryTimeoutMs: 5000,
      connectionTimeoutMs: 15000,
    });
    const config = (ConnectionPool as jest.Mock).mock.calls[0][0];
    expect(config.requestTimeout).toBe(5000);
  });
});
