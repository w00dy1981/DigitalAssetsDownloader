import { stripSqlComments, topLevelWords } from './queryText';

const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\binsert\b/i, label: 'INSERT' },
  { pattern: /\bupdate\b/i, label: 'UPDATE' },
  { pattern: /\bdelete\b/i, label: 'DELETE' },
  { pattern: /\bmerge\b/i, label: 'MERGE' },
  { pattern: /\bdrop\b/i, label: 'DROP' },
  { pattern: /\balter\b/i, label: 'ALTER' },
  { pattern: /\bcreate\b/i, label: 'CREATE' },
  { pattern: /\btruncate\b/i, label: 'TRUNCATE' },
  { pattern: /\bexec\b/i, label: 'EXEC' },
  { pattern: /\bexecute\b/i, label: 'EXECUTE' },
  { pattern: /\bgrant\b/i, label: 'GRANT' },
  { pattern: /\brevoke\b/i, label: 'REVOKE' },
  { pattern: /\bbackup\b/i, label: 'BACKUP' },
  { pattern: /\brestore\b/i, label: 'RESTORE' },
  { pattern: /\bselect\s+[\s\S]*?\binto\b/i, label: 'SELECT INTO' },
  { pattern: /\binto\b/i, label: 'INTO' },
  { pattern: /\bopenrowset\b/i, label: 'OPENROWSET' },
  { pattern: /\bopendatasource\b/i, label: 'OPENDATASOURCE' },
  { pattern: /\bbulk\b/i, label: 'BULK' },
  { pattern: /\bxp_[a-z0-9_]*\b/i, label: 'xp_' },
  { pattern: /\bsp_[a-z0-9_]*\b/i, label: 'sp_' },
];

export interface ReadOnlySqlQuery {
  query: string;
  words: ReturnType<typeof topLevelWords>;
  selectIndex: number;
}

type SqlValidationResult =
  | ({ isValid: true } & ReadOnlySqlQuery)
  | { isValid: false; errors: string[] };

export function validateSqlQuery(
  query: string,
  allowedCrossDatabases: string[] = []
): SqlValidationResult {
  const strippedQuery =
    typeof query === 'string' ? stripSqlComments(query) : '';
  const errors: string[] = [];
  if (!strippedQuery) {
    return { isValid: false, errors: ['SQL query is required'] };
  }

  if (strippedQuery.includes(';')) {
    errors.push('Semicolon-separated SQL batches are not allowed');
  }

  if (!/^(select|with)\b/i.test(strippedQuery)) {
    errors.push('Only SELECT queries are allowed');
  }

  for (const { pattern, label } of DANGEROUS_PATTERNS) {
    if (pattern.test(strippedQuery)) {
      errors.push(`${label} is not allowed`);
    }
  }

  // Cross-database allow-list: if non-empty, only listed databases may appear
  // in three-part names such as WebScrapes.dbo.table or [WebScrapes].dbo.table
  if (allowedCrossDatabases.length > 0) {
    const crossDbPattern = /\[?(\w+)\]?\.\w+\.\w+/gi;
    let match: RegExpExecArray | null;
    while ((match = crossDbPattern.exec(strippedQuery)) !== null) {
      const dbName = match[1];
      if (
        !allowedCrossDatabases.some(
          a => a.toLowerCase() === dbName.toLowerCase()
        )
      ) {
        errors.push(
          `Cross-database reference to '${dbName}' is not allowed. Allowed databases: ${allowedCrossDatabases.join(', ')}`
        );
      }
    }
  }

  if (errors.length) return { isValid: false, errors };

  const words = topLevelWords(strippedQuery);
  const select = words.find(token => token.word === 'SELECT');
  if (!select) {
    return { isValid: false, errors: ['Only SELECT queries are allowed'] };
  }
  if (words.some(token => token.word === 'SET')) {
    return { isValid: false, errors: ['SET is not allowed'] };
  }

  return {
    isValid: true,
    query: strippedQuery,
    words,
    selectIndex: select.index,
  };
}
