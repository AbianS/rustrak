/** Where one span's bar sits on the shared clock, as CSS percentages. */
export interface BarGeometry {
  /** Distance from the left edge of the track. */
  offsetPct: number;
  /** Width of the bar, already clipped to the track's right edge. */
  widthPct: number;
}

/** Below this a bar rounds to nothing on screen. */
const MIN_VISIBLE_PCT = 0.5;

/**
 * One span's bar, placed against the window every row in a waterfall shares.
 *
 * All four arguments are in the same unit, whichever the caller keeps its
 * clock in: the agent trace counts milliseconds, the transaction waterfall
 * counts seconds, and this does not need to know which.
 *
 * Two floors carry the whole reason it exists. A 2 ms span inside a 600 ms
 * trace is 0.3% wide and would round away, so it gets a visible minimum: it
 * may be the one that threw. And a bar starting at 90% that claims 50% is
 * clipped rather than allowed to overhang, because the track is the trace and
 * nothing in the trace happened after it ended.
 */
export function barGeometry(
  startAt: number | null | undefined,
  duration: number | null | undefined,
  windowStart: number,
  windowSize: number,
): BarGeometry {
  if (windowSize <= 0) return { offsetPct: 0, widthPct: 0 };

  const offsetPct =
    startAt == null ? 0 : ((startAt - windowStart) / windowSize) * 100;

  const widthPct =
    duration == null
      ? 0
      : Math.max(MIN_VISIBLE_PCT, (duration / windowSize) * 100);

  return { offsetPct, widthPct: Math.min(widthPct, 100 - offsetPct) };
}
