/** Lower-case ASCII folding for Vietnamese search ("Nguyễn Văn Đạt" → "nguyen van dat"). */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/** Every whitespace-separated token of the query must appear in the haystack. */
export function matchesQuery(haystack: string, query: string): boolean {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const h = fold(haystack);
  return tokens.every((t) => h.includes(t));
}
