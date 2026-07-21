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

/**
 * Selectable time windows for the project overview.
 *
 * Same set as {@link RELEASE_PERIODS} but named separately: the overview
 * spans events, issues and sessions, so it is not tied to release health and
 * should be free to grow its own options.
 */
export const OVERVIEW_PERIODS = ['24h', '7d', '14d', '30d'] as const;

export type OverviewPeriod = (typeof OVERVIEW_PERIODS)[number];

/** Narrow a raw `?period=` value to a supported window, or undefined ("All"). */
export function parseOverviewPeriod(raw?: string): OverviewPeriod | undefined {
  return OVERVIEW_PERIODS.find((p) => p === raw);
}

/**
 * Bucket width, in hours, for a window's charts.
 *
 * A 30-day window in hourly buckets is 720 bars in a tile a few hundred pixels
 * wide, which renders as noise. Widening the bucket with the window keeps the
 * bar count roughly constant, at 24 to 60 bars for every fixed period.
 *
 * "All" (`undefined`) is unbounded by definition, so it takes the widest
 * bucket; the charts additionally cap how many bars they draw, which is what
 * actually protects a years-old project.
 */
export function overviewInterval(period?: OverviewPeriod): number {
  switch (period) {
    case '24h':
      return 1;
    case '7d':
      return 3;
    case '14d':
      return 6;
    case '30d':
      return 12;
    default:
      return 24;
  }
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

/**
 * Chart-token colour for a crash-free rate, on the same 99%/95% tiers as
 * {@link crashFreeClass}.
 *
 * Returns a CSS value rather than a class because it paints marks, not text.
 * Healthy deliberately reuses `--chart-3`, the same hue the session-health
 * chart gives its "Healthy" band: the same idea should not wear two greens on
 * one page.
 */
export function crashFreeColor(rate: number | null): string {
  if (rate === null) return 'var(--sev-info)';
  if (rate >= 0.99) return 'var(--chart-3)';
  if (rate >= 0.95) return 'var(--sev-warning)';
  return 'var(--sev-error)';
}
