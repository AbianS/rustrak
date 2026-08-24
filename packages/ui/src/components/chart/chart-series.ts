/**
 * The series contract and the palette order.
 *
 * They sit beside `chart-parts.tsx` rather than inside it because a file
 * that exports both components and plain values is a file React Fast
 * Refresh cannot preserve state across (`react-doctor/only-export-components`).
 *
 * Colours are CSS variables end to end -- `var(--chart-1)`, `var(--sev-error)`
 * -- which is what lets the same SVG follow the theme. The categorical order
 * is **fixed**: chart-1 to chart-5, assigned by position and never cycled or
 * re-dealt when a series is filtered away. Identity sticks to the entity;
 * the palette was validated (CVD, chroma, contrast) as a sequence, and a
 * sixth series is a design question, not a sixth colour.
 */

/** One drawn series: which field, what to call it, and -- rarely -- what
 *  colour, when the series *is* a status (severity) rather than an entity. */
export interface ChartSeries {
  key: string;
  label: string;
  /** A CSS colour, `var(--token)` only. Absent: the categorical order. */
  color?: string;
}

const CATEGORICAL = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export function seriesColor(series: ChartSeries, index: number): string {
  return series.color ?? CATEGORICAL[index] ?? '';
}
