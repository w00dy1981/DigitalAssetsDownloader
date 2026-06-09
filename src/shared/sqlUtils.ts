/**
 * Strip SQL comments from a query string before validation or execution.
 *
 * Handles:
 *   - Line comments:  -- comment text
 *   - Block comments: /* comment text *\/
 *   - Quoted string literals are preserved intact (-- inside 'a string' is not a comment)
 *   - Escaped single quotes inside literals ('it''s fine') are handled correctly
 *
 * Block comments are replaced with a single space so adjacent tokens don't merge.
 * Line comments consume up to (but not including) the newline so vertical whitespace is preserved.
 */
export function stripSqlComments(query: string): string {
  let result = '';
  let i = 0;
  const len = query.length;

  while (i < len) {
    const char = query[i];

    if (char === "'") {
      // Single-quoted string literal — preserve contents, handle '' escaped quotes
      result += char;
      i++;
      while (i < len) {
        if (query[i] === "'" && query[i + 1] === "'") {
          result += query[i];
          result += query[i + 1];
          i += 2;
        } else if (query[i] === "'") {
          result += query[i];
          i++;
          break;
        } else {
          result += query[i];
          i++;
        }
      }
    } else if (char === '-' && query[i + 1] === '-') {
      // Line comment — consume up to (not including) newline so whitespace is preserved
      while (i < len && query[i] !== '\n') i++;
    } else if (char === '/' && query[i + 1] === '*') {
      // Block comment — replace with a space so adjacent tokens don't merge
      i += 2;
      while (i < len && !(query[i] === '*' && query[i + 1] === '/')) i++;
      if (i < len) i += 2;
      result += ' ';
    } else {
      result += char;
      i++;
    }
  }

  return result.trim();
}
