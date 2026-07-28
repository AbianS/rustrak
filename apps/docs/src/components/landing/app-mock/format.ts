/**
 * Built once, at module scope.
 *
 * `new Intl.NumberFormat(...)` is not a cheap constructor — it resolves a
 * locale and builds a formatter — and this used to run on every call. `compact`
 * is a `Ticker` formatter, so "every call" meant several times a frame for as
 * long as a counter was on screen.
 */
const COMPACT = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/**
 * `compactCount` from apps/webview-ui/src/lib/chart-format.ts.
 *
 * Lives beside the charts rather than inside them because `mock-overview`
 * formats its own counters with it, and a module that exports both a component
 * and a helper cannot keep its state across a Fast Refresh.
 */
export function compact(value: number): string {
  if (Math.abs(value) < 1000) {
    return String(Math.round(value));
  }
  return COMPACT.format(value);
}
