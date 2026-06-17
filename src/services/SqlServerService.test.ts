import * as mssql from 'mssql';
import {
  applySqlRowLimit,
  buildSqlCountQuery,
  redactSqlRequest,
  SqlServerService,
  stripSqlComments,
  stripFinalOrderBy,
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

  it('applies TOP correctly after stripping a line comment', () => {
    expect(
      applySqlRowLimit(
        stripSqlComments('SELECT PartNo -- the part number\nFROM Products'),
        50
      )
    ).toBe('SELECT TOP (50) PartNo \nFROM Products');
  });
});

describe('SqlServerService query counting', () => {
  it('builds a count query for a simple SELECT', () => {
    expect(buildSqlCountQuery('SELECT PartNo FROM Products')).toBe(
      'SELECT COUNT_BIG(1) AS totalRowCount FROM (SELECT PartNo FROM Products) AS sql_count_result'
    );
  });

  it('strips the final ORDER BY before building a count query', () => {
    const query = [
      'SELECT PartNo, ProductTitle',
      'FROM Products',
      'ORDER BY ProductTitle',
    ].join('\n');

    expect(stripFinalOrderBy(query)).toBe(
      ['SELECT PartNo, ProductTitle', 'FROM Products'].join('\n')
    );
    expect(buildSqlCountQuery(query)).toBe(
      `SELECT COUNT_BIG(1) AS totalRowCount FROM (${['SELECT PartNo, ProductTitle', 'FROM Products'].join('\n')}) AS sql_count_result`
    );
  });

  it('preserves ORDER BY inside a window function while stripping the final ORDER BY', () => {
    const query = [
      'SELECT ROW_NUMBER() OVER (ORDER BY ProductTitle) AS RowNo, ProductTitle',
      'FROM Products',
      'ORDER BY ProductTitle',
    ].join('\n');

    expect(stripFinalOrderBy(query)).toBe(
      [
        'SELECT ROW_NUMBER() OVER (ORDER BY ProductTitle) AS RowNo, ProductTitle',
        'FROM Products',
      ].join('\n')
    );
  });

  it('builds a count query for a CTE SELECT', () => {
    const query =
      'WITH ProductRows AS (SELECT PartNo FROM Products) SELECT PartNo FROM ProductRows ORDER BY PartNo';

    expect(buildSqlCountQuery(query)).toBe(
      'WITH ProductRows AS (SELECT PartNo FROM Products) SELECT COUNT_BIG(1) AS totalRowCount FROM (SELECT PartNo FROM ProductRows) AS sql_count_result'
    );
  });
});

describe('stripSqlComments', () => {
  it('strips a line comment from a query', () => {
    expect(stripSqlComments('SELECT 1 -- this is a comment')).toBe('SELECT 1');
  });

  it('strips a block comment from a query', () => {
    expect(stripSqlComments('SELECT /* remove me */ 1')).toBe('SELECT   1');
  });

  it('preserves -- inside a single-quoted string literal', () => {
    expect(
      stripSqlComments("SELECT '-- not a comment' AS col FROM Products")
    ).toBe("SELECT '-- not a comment' AS col FROM Products");
  });

  it('strips dangerous SQL hidden in a line comment', () => {
    expect(stripSqlComments('SELECT 1 -- DROP TABLE Products')).toBe(
      'SELECT 1'
    );
  });

  it('strips dangerous SQL hidden in a block comment', () => {
    expect(stripSqlComments('SELECT /* DELETE FROM Products */ 1')).toBe(
      'SELECT   1'
    );
  });

  it('handles an unterminated block comment without crashing', () => {
    expect(() => stripSqlComments('SELECT 1 /* unterminated')).not.toThrow();
  });

  it('handles multiple line comments across lines', () => {
    const query =
      '-- header comment\nSELECT col1\n-- another comment\n, col2 FROM t';
    expect(stripSqlComments(query)).toBe('SELECT col1\n\n, col2 FROM t');
  });

  it("preserves escaped single quotes ('') inside string literals", () => {
    expect(
      stripSqlComments("SELECT 'it''s a value -- with dashes' FROM Products")
    ).toBe("SELECT 'it''s a value -- with dashes' FROM Products");
  });
});

describe('validateSqlQuery with comments and cross-database names', () => {
  it('accepts a SELECT with a line comment', () => {
    expect(
      validateSqlQuery('SELECT col -- pick this one\nFROM Products')
    ).toEqual({ isValid: true, errors: [] });
  });

  it('accepts a SELECT with a block comment', () => {
    expect(validateSqlQuery('SELECT /* filtered */ col FROM Products')).toEqual(
      { isValid: true, errors: [] }
    );
  });

  it('accepts a CTE query with line comments', () => {
    const query =
      '-- get products\nWITH Rows AS (SELECT id FROM Products)\nSELECT id FROM Rows';
    expect(validateSqlQuery(query)).toEqual({ isValid: true, errors: [] });
  });

  it('still rejects dangerous SQL outside comments', () => {
    const result = validateSqlQuery('SELECT 1; DROP TABLE Products');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'Semicolon-separated SQL batches are not allowed'
    );
  });

  it('rejects dangerous SQL that appears in query text (not in comment)', () => {
    const result = validateSqlQuery('DROP TABLE Products');
    expect(result.isValid).toBe(false);
  });

  it('does NOT execute dangerous SQL that was hidden inside a comment', () => {
    // After stripping comments, only 'SELECT 1' remains — should be valid
    expect(validateSqlQuery('SELECT 1 -- DROP TABLE Products')).toEqual({
      isValid: true,
      errors: [],
    });
  });

  it('allows a cross-database reference when it is in the allow-list', () => {
    expect(
      validateSqlQuery(
        'SELECT p.id, w.url FROM Products p JOIN WebScrapes.dbo.images w ON w.sku = p.sku',
        ['WebScrapes']
      )
    ).toEqual({ isValid: true, errors: [] });
  });

  it('allows a bracketed cross-database reference when it is in the allow-list', () => {
    expect(
      validateSqlQuery(
        'SELECT w.url FROM [WebScrapes].dbo.images w WHERE w.sku = 1',
        ['WebScrapes']
      )
    ).toEqual({ isValid: true, errors: [] });
  });

  it('rejects a cross-database reference not in the allow-list', () => {
    const result = validateSqlQuery('SELECT * FROM HackerDB.dbo.secrets', [
      'WebScrapes',
    ]);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('HackerDB');
    expect(result.errors[0]).toContain('WebScrapes');
  });

  it('allows any cross-database reference when the allow-list is empty', () => {
    expect(validateSqlQuery('SELECT * FROM AnyDB.dbo.AnyTable', [])).toEqual({
      isValid: true,
      errors: [],
    });
  });

  it('does not flag unqualified Baker table references with a non-empty allow-list', () => {
    expect(
      validateSqlQuery(
        "SELECT * FROM [SB_WebProductsInfo] p WHERE p.[Status] = 'A'",
        ['WebScrapes']
      )
    ).toEqual({ isValid: true, errors: [] });
  });

  it('accepts a cross-database reference inside a CTE with an allow-list', () => {
    const query = [
      'WITH ProductRows AS (',
      '  SELECT p.id, w.url',
      '  FROM Products p',
      '  JOIN WebScrapes.dbo.images w ON w.sku = p.sku',
      ')',
      'SELECT * FROM ProductRows',
    ].join('\n');
    expect(validateSqlQuery(query, ['WebScrapes'])).toEqual({
      isValid: true,
      errors: [],
    });
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
    mockQuery
      .mockResolvedValueOnce({
        recordset: [
          { PartNo: ' ABC ', ImageUrl: 'https://example.com/image.jpg' },
        ],
      })
      .mockResolvedValueOnce({
        recordset: [{ totalRowCount: 1384 }],
      });

    const result = await service.previewQuery(request);

    expect(result.rows).toEqual([
      { PartNo: 'ABC', ImageUrl: 'https://example.com/image.jpg' },
    ]);
    expect(existingLoadedRows).toEqual([{ PartNo: 'Existing' }]);
    expect(result.rowCount).toBe(1);
    expect(result.totalRowCount).toBe(1384);
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT TOP (50) PartNo, ImageUrl FROM Products'
    );
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT COUNT_BIG(1) AS totalRowCount FROM (SELECT PartNo, ImageUrl FROM Products) AS sql_count_result'
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
    const service = new SqlServerService();
    await service.testConnection({
      server: 'test-server',
      database: 'TestDB',
      username: 'user',
      password: 'pass',
      queryTimeoutMs: 5000,
      connectionTimeoutMs: 15000,
    });
    const config = (mssql.ConnectionPool as jest.Mock).mock.calls[0][0];
    expect(config.requestTimeout).toBe(5000);
  });
});
