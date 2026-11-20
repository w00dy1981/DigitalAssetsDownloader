import type { ReadOnlySqlQuery } from './queryPolicy';

export function buildSqlCountQuery({
  query,
  words,
  selectIndex,
}: ReadOnlySqlQuery): string {
  const order = words.findIndex(
    (token, index) => token.word === 'ORDER' && words[index + 1]?.word === 'BY'
  );
  // Pagination and ties depend on ORDER BY even when only counting rows.
  const keepOrder =
    words.slice(order + 2).some(token => token.word === 'OFFSET') ||
    words.some(
      (token, index) =>
        token.word === 'WITH' && words[index + 1]?.word === 'TIES'
    );
  const end = order >= 0 && !keepOrder ? words[order].index : query.length;
  const prefix = query.slice(0, selectIndex);
  const body = query.slice(selectIndex, end).trimEnd();

  return `${prefix}SELECT COUNT_BIG(1) AS totalRowCount FROM (${body}) AS sql_count_result`;
}
