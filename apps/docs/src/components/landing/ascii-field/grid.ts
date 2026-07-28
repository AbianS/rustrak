/**
 * The painting, as a grid of glyphs and the schedule each one arrives on.
 *
 * Everything here is arithmetic over the pre-rendered ASCII: no canvas, no
 * React, no time. The renderer decides what a cell looks like at an instant;
 * this decides what a cell *is*.
 */

/** The ramp the offline pass used. Index here means ink, and drives colour. */
export const RAMP = ' .`:;+*oOX#%@';

/** Ramp index at which a character moves up a colour bucket. */
const MID = 5;
const HOT = 9;

/**
 * Painting size, in CSS pixels. Not tied to the viewport: the canvas is drawn
 * once at its natural size and then scaled by CSS, so this only decides how
 * much bitmap the glyphs get.
 */
export const FONT = 8;
export const LEADING = 1.02;

/** Seconds between the first cell settling and the last one starting. */
export const SPREAD = 2.2;
/** Seconds one cell spends flickering before it locks onto its glyph. */
export const SETTLE = 0.55;

/** Deterministic per-cell noise. Stable for delays, per-frame for scramble. */
export function hash(n: number): number {
  let h = n ^ 61 ^ (n >>> 16);
  h = h + (h << 3);
  h = h ^ (h >>> 4);
  h = Math.imul(h, 0x27d4eb2d);
  h = h ^ (h >>> 15);
  return (h >>> 0) / 4294967296;
}

/** Which of the four paint lanes a settled cell belongs to. */
export const bucketOf = (ink: number) => (ink >= HOT ? 3 : ink >= MID ? 2 : 1);

export interface Grid {
  cols: number;
  rowCount: number;
  /** Ramp index per cell, 0 = never drawn. Row-major, `y * cols + x`. */
  glyphs: Uint8Array;
  /** Seconds before this cell starts resolving. Same indexing as `glyphs`. */
  delay: Float32Array;
  cellW: number;
  cellH: number;
}

/**
 * Parse the ASCII into per-cell ink and a per-cell start time.
 *
 * Returns `null` for anything that is not a usable picture, which is the same
 * answer a failed fetch gives: a background that is not there.
 */
export function buildGrid(text: string, cellW: number): Grid | null {
  const rows = text.split('\n').filter((row) => row.length > 0);
  if (rows.length === 0) return null;

  const cols = rows[0].length;
  const rowCount = rows.length;
  const cellH = FONT * LEADING;
  const glyphs = new Uint8Array(cols * rowCount);
  const delay = new Float32Array(cols * rowCount);

  for (let y = 0; y < rowCount; y++) {
    const row = rows[y];
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const ink = RAMP.indexOf(row[x]);
      glyphs[i] = ink > 0 ? ink : 0;

      // Outward from the centre, corrected for the cell's own aspect so
      // the front is round on screen rather than round in grid space.
      const dx = (x / cols - 0.5) * 2;
      const dy = ((y / rowCount - 0.5) * 2 * cellH * rowCount) / (cellW * cols);
      const radius = Math.min(1, Math.hypot(dx, dy) / 1.15);
      delay[i] = (radius * 0.72 + hash(i) * 0.28) * SPREAD;
    }
  }

  return { cols, rowCount, glyphs, delay, cellW, cellH };
}
