/**
 * Formatting shared by the overview charts and stat tiles, so a count reads
 * the same whether it lands on an axis, in a tooltip or on a KPI tile.
 */

/** `12403` -> `12.4k`. Used where space is tight (axis ticks, hero figures). */
export function compactCount(value: number): string {
  if (Math.abs(value) < 1000) {
    return value.toString();
  }
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

/** `12403` -> `12,403`. Used in tooltips and tables, where exactness matters. */
export function exactCount(value: number): string {
  return value.toLocaleString();
}

/**
 * Relative change from `previous` to `current`.
 *
 * Returns `null` when there is nothing to compare against: no previous window
 * at all (an all-time request), or a previous window of zero, where any
 * increase is an undefined percentage rather than "+100%".
 */
export function percentChange(
  current: number,
  previous: number | null,
): number | null {
  if (previous === null || previous === 0) {
    return null;
  }
  return (current - previous) / previous;
}

/** `0.183` -> `+18.3%`. */
export function formatPercentChange(change: number): string {
  const sign = change > 0 ? '+' : '';
  return `${sign}${(change * 100).toFixed(1)}%`;
}
