import { describe, expect, it } from 'vitest';
import { barGeometry } from './waterfall-geometry';

describe('barGeometry', () => {
  it('places a bar at its share of the window', () => {
    expect(barGeometry(150, 50, 100, 200)).toEqual({
      offsetPct: 25,
      widthPct: 25,
    });
  });

  it('fills the window for a span that covers all of it', () => {
    expect(barGeometry(100, 200, 100, 200)).toEqual({
      offsetPct: 0,
      widthPct: 100,
    });
  });

  it('keeps a span far shorter than the window visible', () => {
    // 0.05% of the window, which would round to nothing on screen. It may be
    // the span that threw, so it gets the floor instead.
    expect(barGeometry(100, 0.1, 100, 200).widthPct).toBe(0.5);
  });

  it('never runs a bar past the right edge', () => {
    // Starts at 45% of the window and claims 75% of it: a span still running
    // when the trace was cut. The overhang is clipped, not wrapped.
    expect(barGeometry(190, 150, 100, 200)).toEqual({
      offsetPct: 45,
      widthPct: 55,
    });
  });

  it('draws nothing for a span with no duration', () => {
    expect(barGeometry(150, null, 100, 200)).toEqual({
      offsetPct: 25,
      widthPct: 0,
    });
  });

  it('sits at the left edge when the span has no start', () => {
    expect(barGeometry(null, 50, 100, 200)).toEqual({
      offsetPct: 0,
      widthPct: 25,
    });
  });

  it('reads undefined the same as null: an absent field is an absent value', () => {
    expect(barGeometry(undefined, undefined, 100, 200)).toEqual({
      offsetPct: 0,
      widthPct: 0,
    });
  });

  /**
   * Skewed data, not a drawing problem: an SDK whose clock ran backwards
   * between the start and the end it reported. It used to produce a negative
   * width, which is not a bar at all.
   */
  it('draws nothing for a span that starts after the window ends', () => {
    expect(barGeometry(350, 10, 100, 200)).toEqual({
      offsetPct: 100,
      widthPct: 0,
    });
  });

  it('never returns a negative width', () => {
    for (const startAt of [201, 300, 1000]) {
      expect(barGeometry(startAt, 10, 0, 200).widthPct).toBeGreaterThanOrEqual(
        0,
      );
    }
  });

  it('pins a span that starts before the window to the left edge', () => {
    expect(barGeometry(50, 50, 100, 200).offsetPct).toBe(0);
  });

  it('draws nothing at all in a window of zero width', () => {
    // Every span in a trace that started and ended in the same instant.
    expect(barGeometry(100, 50, 100, 0)).toEqual({
      offsetPct: 0,
      widthPct: 0,
    });
  });
});
