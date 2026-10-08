/**
 * Fuzzy matching for the command palette: every query character must appear in order
 * (case-insensitive). Matches score higher when they start words, run consecutively, or start
 * the text; label matches beat keyword-only matches. Returns null for no match.
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return 0;
  const t = text.toLowerCase();
  let score = 0;
  let ti = 0;
  let previous = -2;
  for (const ch of q) {
    if (ch === ' ') continue;
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    const wordStart = found === 0 || /[\s:/(-]/.test(t[found - 1]!);
    score += 1;
    if (found === previous + 1) score += 3;
    if (wordStart) score += 4;
    if (found === 0) score += 2;
    score -= Math.min(3, (found - ti) * 0.1);
    previous = found;
    ti = found + 1;
  }
  return score;
}

/** Items that match, best first; ties keep their original order. */
export function fuzzyFilter<T>(
  query: string,
  items: T[],
  label: (item: T) => string,
  keywords: (item: T) => string = () => '',
): T[] {
  if (!query.trim()) return items;
  return items
    .map((item, index) => {
      const own = fuzzyScore(query, label(item));
      const extra = fuzzyScore(query, `${label(item)} ${keywords(item)}`);
      const score = own !== null ? own + 10 : extra;
      return { item, index, score };
    })
    .filter((x): x is { item: T; index: number; score: number } => x.score !== null)
    .sort((x, y) => y.score - x.score || x.index - y.index)
    .map((x) => x.item);
}
