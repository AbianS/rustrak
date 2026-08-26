import type { MessageKey } from '@rustrak/i18n';

/**
 * The windows every screen in the product is read over.
 *
 * The server takes anything from an hour to ninety days, so these four are a
 * choice of framing rather than a limit. `24h` is the default everywhere,
 * because both the list and an overview are usually opened to answer "what is
 * on fire now".
 */
export const PERIODS = ['24h', '7d', '30d', '90d'] as const;

export type Period = (typeof PERIODS)[number];

export const DEFAULT_PERIOD: Period = '24h';

export const PERIOD_LABELS: Record<Period, MessageKey> = {
  '24h': 'periods.h24',
  '7d': 'periods.d7',
  '30d': 'periods.d30',
  '90d': 'periods.d90',
};

/** `undefined` for the default, so it stays out of the address bar. */
export function validPeriod(value: unknown): Period | undefined {
  if (value === DEFAULT_PERIOD) return undefined;
  return PERIODS.includes(value as Period) ? (value as Period) : undefined;
}

/**
 * How wide a bucket should be, in hours, for a chart drawn over the window.
 *
 * Aimed at roughly sixty points: enough for the shape of a spike to survive,
 * few enough that the bars are still wide enough to hit with a pointer. The
 * server caps the interval at 24, which is why ninety days is ninety points
 * rather than forty-five.
 */
export function bucketHours(period: Period): number {
  switch (period) {
    case '24h':
      return 1;
    case '7d':
      return 3;
    case '30d':
      return 12;
    case '90d':
      return 24;
  }
}
