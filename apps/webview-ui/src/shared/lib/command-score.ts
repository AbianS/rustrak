const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

function scoreTerm(
  target: string,
  words: string[],
  acronym: string,
  term: string,
): number {
  if (target.startsWith(term)) return 1;
  if (words.some((word) => word.startsWith(term))) return 0.8;
  if (term.length > 1 && acronym.startsWith(term)) return 0.6;
  if (target.includes(term)) return 0.3;
  return 0;
}

/**
 * Ranks one command row against a query. Returns 0 when the row should be
 * hidden, and a larger number the better it matches.
 *
 * Deliberately stricter than the fuzzy subsequence matching cmdk ships with.
 * The palette renders every project's pages once a query exists, which is
 * several hundred rows on a real instance, and a matcher that accepts any
 * scattered subsequence hands back most of them for a three-letter query.
 *
 * Two rules do the work: a term has to land on a word boundary or inside the
 * text, never as scattered letters, and *every* term has to land. The second
 * is what makes "acme iss" narrow to one row where "iss" alone cannot.
 */
export function scoreCommand(haystack: string, query: string): number {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 1;

  const target = normalize(haystack);
  const words = target.split(/[^a-z0-9]+/).filter(Boolean);
  const acronym = words.map((word) => word[0]).join('');

  let total = 0;
  for (const term of terms) {
    const score = scoreTerm(target, words, acronym, term);
    if (score === 0) return 0;
    total += score;
  }

  return total / terms.length;
}
