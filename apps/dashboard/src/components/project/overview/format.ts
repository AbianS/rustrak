import type { Period } from '../../../lib/period';

/**
 * The formatters one render of the overview needs, built once.
 *
 * `Intl.NumberFormat` is expensive to construct and cheap to reuse, and this
 * page draws four figures, three axes and three lists from the same four
 * shapes. Building them per cell is measurable on a 90-day chart.
 */
export function numberFormats(locale: string) {
  return {
    integer: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    compact: new Intl.NumberFormat(locale, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }),
    /** A crash-free rate: 0.9843 reads as `98.4 %`. */
    rate: new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
  };
}

/**
 * How a bucket's timestamp is written on an axis and in a tooltip.
 *
 * A day of hourly buckets wants the clock and nothing else; ninety days of
 * daily ones want the date and nothing else. Printing both on either is what
 * turns an axis into a wall of text that has to be read rather than skimmed.
 */
export function bucketLabel(
  locale: string,
  period: Period,
): (value: string | number) => string {
  const format = new Intl.DateTimeFormat(
    locale,
    period === '24h'
      ? { hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short' },
  );

  return (value) => {
    const at = new Date(value);
    return Number.isNaN(at.getTime()) ? String(value) : format.format(at);
  };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago, in words: `hace 12 min`, `hace 3 d`.
 *
 * `Intl.RelativeTimeFormat` rather than a table of strings, because the plural
 * rules are the part that gets this wrong and every locale has its own. The
 * unit is picked by size, so nothing ever reads `hace 4320 min`.
 */
export function relativeTime(locale: string, iso: string, now = Date.now()) {
  const format = new Intl.RelativeTimeFormat(locale, {
    numeric: 'auto',
    style: 'narrow',
  });
  const elapsed = new Date(iso).getTime() - now;

  if (Number.isNaN(elapsed)) return iso;

  const size = Math.abs(elapsed);
  if (size < HOUR) return format.format(Math.round(elapsed / MINUTE), 'minute');
  if (size < DAY) return format.format(Math.round(elapsed / HOUR), 'hour');
  return format.format(Math.round(elapsed / DAY), 'day');
}

/**
 * One unit for a whole axis, chosen from its largest value.
 *
 * {@link duration} picks per value, which is right in a sentence and wrong on
 * an axis: it prints `0 ms` under `7,5 s` and the reader has to notice the
 * unit changed between two ticks that are supposed to be one scale.
 */
export function durationAxis(locale: string, max: number) {
  const seconds = max >= 1000;
  const format = new Intl.NumberFormat(locale, {
    maximumFractionDigits: seconds ? 1 : 0,
  });

  return (value: number) =>
    seconds ? `${format.format(value / 1000)} s` : `${format.format(value)} ms`;
}
