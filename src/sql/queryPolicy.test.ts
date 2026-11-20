import { validateSqlQuery } from './queryPolicy';
import { stripSqlComments } from './queryText';

describe('validateSqlQuery', () => {
  it('allows simple SELECT queries', () => {
    expect(
      validateSqlQuery('SELECT PartNo, ImageUrl FROM Products')
    ).toMatchObject({
      isValid: true,
    });
  });

  it('allows WITH SELECT queries', () => {
    expect(
      validateSqlQuery(
        'WITH ProductRows AS (SELECT PartNo FROM Products) SELECT PartNo FROM ProductRows'
      )
    ).toMatchObject({ isValid: true });
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
    if (result.isValid) throw new Error('Expected SQL query to be rejected');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects non-select queries', () => {
    const result = validateSqlQuery('DECLARE @x int');
    expect(result.isValid).toBe(false);
    if (result.isValid) throw new Error('Expected SQL query to be rejected');
    expect(result.errors).toContain('Only SELECT queries are allowed');
  });
});

describe('stripSqlComments', () => {
  it('strips a line comment from a query', () => {
    expect(stripSqlComments('SELECT 1 -- this is a comment')).toBe('SELECT 1');
  });

  it('strips a block comment from a query', () => {
    expect(stripSqlComments('SELECT /* remove me */ 1')).toBe('SELECT   1');
  });

  it('preserves quoted names while removing nested comments', () => {
    expect(
      stripSqlComments(
        'SELECT [--name] /* outer /* nested */ end */ FROM Products'
      )
    ).toBe('SELECT [--name]   FROM Products');
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
    ).toMatchObject({ isValid: true });
  });

  it('accepts a SELECT with a block comment', () => {
    expect(
      validateSqlQuery('SELECT /* filtered */ col FROM Products')
    ).toMatchObject({ isValid: true });
  });

  it('accepts a CTE query with line comments', () => {
    const query =
      '-- get products\nWITH Rows AS (SELECT id FROM Products)\nSELECT id FROM Rows';
    expect(validateSqlQuery(query)).toMatchObject({
      isValid: true,
    });
  });

  it('still rejects dangerous SQL outside comments', () => {
    const result = validateSqlQuery('SELECT 1; DROP TABLE Products');
    expect(result.isValid).toBe(false);
    if (result.isValid) throw new Error('Expected SQL query to be rejected');
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
    expect(validateSqlQuery('SELECT 1 -- DROP TABLE Products')).toMatchObject({
      isValid: true,
    });
  });

  it('allows a cross-database reference when it is in the allow-list', () => {
    expect(
      validateSqlQuery(
        'SELECT p.id, w.url FROM Products p JOIN WebScrapes.dbo.images w ON w.sku = p.sku',
        ['WebScrapes']
      )
    ).toMatchObject({ isValid: true });
  });

  it('allows a bracketed cross-database reference when it is in the allow-list', () => {
    expect(
      validateSqlQuery(
        'SELECT w.url FROM [WebScrapes].dbo.images w WHERE w.sku = 1',
        ['WebScrapes']
      )
    ).toMatchObject({ isValid: true });
  });

  it('rejects a cross-database reference not in the allow-list', () => {
    const result = validateSqlQuery('SELECT * FROM HackerDB.dbo.secrets', [
      'WebScrapes',
    ]);
    expect(result.isValid).toBe(false);
    if (result.isValid) throw new Error('Expected SQL query to be rejected');
    expect(result.errors[0]).toContain('HackerDB');
    expect(result.errors[0]).toContain('WebScrapes');
  });

  it('allows any cross-database reference when the allow-list is empty', () => {
    expect(
      validateSqlQuery('SELECT * FROM AnyDB.dbo.AnyTable', [])
    ).toMatchObject({
      isValid: true,
    });
  });

  it('does not flag unqualified Baker table references with a non-empty allow-list', () => {
    expect(
      validateSqlQuery(
        "SELECT * FROM [SB_WebProductsInfo] p WHERE p.[Status] = 'A'",
        ['WebScrapes']
      )
    ).toMatchObject({ isValid: true });
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
    expect(validateSqlQuery(query, ['WebScrapes'])).toMatchObject({
      isValid: true,
    });
  });
});
