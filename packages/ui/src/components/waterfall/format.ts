/**
 * A span's duration, in the unit that reads: microseconds under a
 * millisecond, a decimal only while the number is small enough to need
 * one, seconds past a thousand. Its own module because the waterfall's
 * consumers format durations outside the trace too -- a detail panel, a
 * summary line -- and a component file may only export components.
 */
export function formatSpanDuration(ms: number): string {
  if (ms < 1) return `${Math.round(ms * 1000)} µs`;
  if (ms < 1000) return `${ms < 10 ? ms.toFixed(1) : Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
