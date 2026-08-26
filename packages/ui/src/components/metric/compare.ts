/**
 * The arithmetic behind a `Metric`'s change, apart from the component.
 *
 * It sits beside `metric.tsx` rather than inside it for the same reason
 * `menu-parts.ts` does: a file that exports both components and plain values is
 * a file React Fast Refresh cannot preserve state across.
 */

/**
 * Which direction is the good one.
 *
 * There is no default, and that is deliberate: errors going up and crash-free
 * sessions going up are the same arrow and opposite news, and a component that
 * guessed would be right half the time and green while the product burns the
 * other half.
 */
export type MetricPolarity = 'up-is-bad' | 'up-is-good' | 'neutral';

export interface MetricComparison {
  /** The change, as a whole percentage. Negative means it fell. */
  percent: number;
  tone: 'positive' | 'negative' | 'neutral';
}

/**
 * A counter against the same counter over the window before it.
 *
 * `null` when there is nothing to compare against, and the two cases that
 * produce it are different: `previous` being null means the window has no
 * earlier window -- an all-time figure -- and `previous` being zero means the
 * change is undefined rather than infinite. Neither is a 100 % rise, which is
 * what naive arithmetic prints for both.
 */
export function compareMetric(
  current: number,
  previous: number | null | undefined,
  polarity: MetricPolarity,
): MetricComparison | null {
  if (previous == null || previous === 0) {
    return null;
  }

  const percent = Math.round(((current - previous) / previous) * 100);

  if (percent === 0 || polarity === 'neutral') {
    return { percent, tone: 'neutral' };
  }

  const rose = percent > 0;
  const good = polarity === 'up-is-good' ? rose : !rose;

  return { percent, tone: good ? 'positive' : 'negative' };
}
