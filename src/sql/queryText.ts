export function stripSqlComments(query: string): string {
  const tokens =
    /--[^\r\n]*|\/\*|'(?:''|[^'])*'|"(?:""|[^"])*"|\[(?:\]\]|[^\]])*\]/g;
  let cursor = 0;
  let result = '';
  let token: RegExpExecArray | null;

  while ((token = tokens.exec(query)) !== null) {
    if (token[0].startsWith('--')) {
      result += query.slice(cursor, token.index);
      cursor = tokens.lastIndex;
    } else if (token[0] === '/*') {
      result += query.slice(cursor, token.index) + ' ';
      const markers = /\/\*|\*\//g;
      markers.lastIndex = tokens.lastIndex;
      let depth = 1;
      let marker: RegExpExecArray | null;
      while (depth > 0 && (marker = markers.exec(query)) !== null) {
        depth += marker[0] === '/*' ? 1 : -1;
      }
      cursor = depth === 0 ? markers.lastIndex : query.length;
      tokens.lastIndex = cursor;
    }
  }
  return (result + query.slice(cursor)).trim();
}

export function topLevelWords(
  query: string
): { word: string; index: number }[] {
  const tokens =
    /'(?:''|[^'])*'|"(?:""|[^"])*"|\[(?:\]\]|[^\]])*\]|[\p{L}\p{N}_@$#]+|[()]/gu;
  const words: { word: string; index: number }[] = [];
  let depth = 0;
  let token: RegExpExecArray | null;

  while ((token = tokens.exec(query)) !== null) {
    const value = token[0];
    if (value === '(') depth++;
    else if (value === ')') depth--;
    else if (depth === 0) {
      words.push({ word: value.toUpperCase(), index: token.index });
    }
  }
  return words;
}
