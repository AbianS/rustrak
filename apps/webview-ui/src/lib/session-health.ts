/**
 * Selectable time windows for release health, in the order they are offered.
 * Shared by the page (which validates the URL against it) and the filter bar
 * (which renders it), so a value in the URL always maps to a visible button.
 */
export const RELEASE_PERIODS = ['24h', '7d', '14d', '30d'] as const;

export type ReleasePeriod = (typeof RELEASE_PERIODS)[number];

/** Narrow a raw `?period=` value to a supported window, or undefined ("All"). */
export function parseReleasePeriod(raw?: string): ReleasePeriod | undefined {
  return RELEASE_PERIODS.find((p) => p === raw);
}

/** Format a crash-free rate as a percentage string, or an em dash when unknown. */
export function pct(rate: number | null): string {
  if (rate === null) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

/** Text color class for a crash-free rate, tiered at 99%/95%. */
export function crashFreeClass(rate: number | null): string {
  if (rate === null) return 'text-muted-foreground';
  if (rate >= 0.99) return 'text-green-600 dark:text-green-400';
  if (rate >= 0.95) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}
