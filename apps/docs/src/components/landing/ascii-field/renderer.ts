import { bucketOf, type Grid, hash, RAMP, SETTLE } from './grid';

/**
 * Everything that puts pixels on the canvas, for one grid.
 *
 * A factory rather than free functions because the whole thing hangs together
 * on state that is expensive to rebuild and pointless to pass around: the four
 * reused lanes, the trimmed-run buffers, and the crop. All of it is per-canvas
 * and none of it is per-frame.
 */
export function createRenderer(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  box: HTMLElement,
  grid: Grid,
  intensity: number,
) {
  const { cols, rowCount, glyphs, delay, cellW, cellH } = grid;

  /* ---- painting ---- */
  // Four tones while resolving: the first is the flicker, barely there,
  // so the grid reads as static condensing rather than as glyphs fading.
  const lime = (alpha: number, warm = false) =>
    `rgba(${warm ? '226, 255, 140' : '197, 241, 30'}, ${(
      alpha * intensity
    ).toFixed(3)})`;
  const styles = [lime(0.09), lime(0.22), lime(0.46), lime(0.78, true)];

  // Reused across frames: allocating four 400-entry arrays per row per
  // frame is the one thing that would make this loop expensive.
  const lane = [
    new Array<string>(cols),
    new Array<string>(cols),
    new Array<string>(cols),
    new Array<string>(cols),
  ];

  /**
   * One trimmed run per row per lane, or `null` for a row that lane does
   * not touch. Indices stay aligned with `y`.
   *
   * Holding the joined lane verbatim meant four strings of `cols`
   * characters per row every frame, with `fillText` advancing the pen
   * across hundreds of positions that were almost all spaces. The lanes
   * are sparse by construction — a cell is in lane 0 or 1 only while
   * flickering and 1, 2 or 3 only once settled — so most hold a handful
   * of glyphs scattered through several hundred spaces.
   *
   * Trimming to the painted extent is pixel-for-pixel identical: the font
   * is monospace and `cellW` is its measured advance, so starting at
   * `first * cellW` puts every glyph where the leading spaces would have.
   *
   * Band-limiting per row would not have worked here. The reveal's jitter
   * spreads delays across 0.616s against a 0.55s settle window, leaving
   * cells in flux across roughly three quarters of the radius at any
   * instant, so a min/max span would cover nearly the whole row.
   */
  const out: Array<Array<{ x: number; text: string } | null>> = [
    [],
    [],
    [],
    [],
  ];

  /**
   * Trims one lane to its painted extent. `null` when it holds nothing.
   *
   * The bounds are given rather than assumed, because the lanes are
   * allocated at full grid width and reused by two callers that fill
   * different parts of them: the full paint fills the visible column
   * window, and an idle patch fills only its own span. Reading past what
   * this caller wrote would drag in whatever the other one left behind.
   *
   * `base` is the canvas x of index 0 of the lane, which is 0 when the
   * lane is indexed by column and the patch's left edge when it is not.
   */
  const runOf = (
    glyphLane: string[],
    from: number,
    to: number,
    base = 0,
  ): { x: number; text: string } | null => {
    let first = from;
    while (first <= to && glyphLane[first] === ' ') first++;
    if (first > to) return null;
    let last = to;
    while (last > first && glyphLane[last] === ' ') last--;
    return {
      x: base + first * cellW,
      text: glyphLane.slice(first, last + 1).join(''),
    };
  };

  /* ---- the crop ---- */

  /**
   * The columns and rows `object-fit: cover` will actually show.
   *
   * Cover scales by whichever axis needs the larger factor and centres the
   * overflow, so the visible source rectangle is the box divided by that
   * factor, centred. Everything outside it is painted into pixels the
   * element does not have.
   *
   * A column of margin either side, because the mask and the drift both
   * move the frame by a hair and a crop fitted exactly would show its own
   * edge as a column of missing glyphs.
   */
  let colFrom = 0;
  let colTo = cols - 1;
  let rowFrom = 0;
  let rowTo = rowCount - 1;

  const measure = () => {
    const rect = box.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    const scale = Math.max(
      rect.width / canvas.width,
      rect.height / canvas.height,
    );
    const halfW = rect.width / scale / 2;
    const halfH = rect.height / scale / 2;

    const from = Math.max(
      0,
      Math.floor((canvas.width / 2 - halfW) / cellW) - 1,
    );
    const to = Math.min(
      cols - 1,
      Math.ceil((canvas.width / 2 + halfW) / cellW) + 1,
    );
    const top = Math.max(
      0,
      Math.floor((canvas.height / 2 - halfH) / cellH) - 1,
    );
    const bottom = Math.min(
      rowCount - 1,
      Math.ceil((canvas.height / 2 + halfH) / cellH) + 1,
    );

    const changed =
      from !== colFrom || to !== colTo || top !== rowFrom || bottom !== rowTo;
    colFrom = from;
    colTo = to;
    rowFrom = top;
    rowTo = bottom;
    return changed;
  };

  /**
   * Repaints the cropped band.
   *
   * `elapsed` of `null` is the resolved picture: every cell at its resting
   * glyph, no flicker, which is also what reduced motion gets.
   */
  const paint = (elapsed: number | null) => {
    for (let b = 0; b < 4; b++) out[b].length = 0;

    for (let y = rowFrom; y <= rowTo; y++) {
      for (let b = 0; b < 4; b++) lane[b].fill(' ', colFrom, colTo + 1);

      for (let x = colFrom; x <= colTo; x++) {
        const i = y * cols + x;
        const ink = glyphs[i];
        if (ink === 0) continue;

        if (elapsed === null) {
          lane[bucketOf(ink)][x] = RAMP[ink];
          continue;
        }

        const t = (elapsed - delay[i]) / SETTLE;
        if (t <= 0) continue;
        if (t >= 1) {
          lane[bucketOf(ink)][x] = RAMP[ink];
          continue;
        }

        // Flicker: a different glyph every frame, biased brighter as the
        // cell approaches its resting value so it appears to gather.
        const noise = hash(i * 7919 + Math.floor(elapsed * 1000));
        const reach =
          1 + Math.floor(noise * (RAMP.length - 1) * (0.35 + 0.65 * t));
        lane[t < 0.55 ? 0 : 1][x] = RAMP[Math.min(RAMP.length - 1, reach)];
      }

      for (let b = 0; b < 4; b++) out[b].push(runOf(lane[b], colFrom, colTo));
    }

    // Only the cropped band is cleared. On a phone that is a fifth of the
    // bitmap — 466k pixels rather than 2.3M, thirty times a second.
    ctx.clearRect(
      colFrom * cellW,
      rowFrom * cellH,
      (colTo - colFrom + 1) * cellW,
      (rowTo - rowFrom + 1) * cellH + 1,
    );
    for (let b = 0; b < 4; b++) {
      ctx.fillStyle = styles[b];
      const lines = out[b];
      for (let y = 0; y < lines.length; y++) {
        const run = lines[y];
        // A row this lane never touched costs nothing at all now, where
        // before it cost a full-width `fillText` of pure whitespace.
        // `out` starts at `rowFrom`, so the row index has to be offset
        // back onto the grid.
        if (run) ctx.fillText(run.text, run.x, ((y + rowFrom) * cellH) | 0);
      }
    }
  };

  /* ---- idle: patches that come apart and knit back together ---- */

  /**
   * A disturbance: an ellipse of grid that dissolves and reforms.
   *
   * The idle effect has to be local. Repainting all 53,000 cells forever
   * is fine for a three second reveal and ruinous as a permanent loop, so
   * a handful of small regions are disturbed at a time and only their own
   * pixels are cleared and redrawn.
   */
  const patches: Patch[] = [];

  /**
   * How disturbed a cell is right now, 0 to 1.
   *
   * `sin(πt)` over the patch's life is what makes it come apart *and*
   * come back rather than fade away — the peak is halfway through, so
   * every patch is a full round trip. The radial falloff is what stops
   * it reading as a rectangle: the region is cleared as a box, but the
   * disturbance inside it is an ellipse with soft edges.
   */
  const disturbance = (x: number, y: number, time: number) => {
    let worst = 0;
    for (let p = 0; p < patches.length; p++) {
      const patch = patches[p];
      const age = (time - patch.born) / patch.life;
      if (age <= 0 || age >= 1) continue;
      const dx = (x - patch.cx) / patch.rx;
      const dy = (y - patch.cy) / patch.ry;
      const d = dx * dx + dy * dy;
      if (d >= 1) continue;
      const here = Math.sin(Math.PI * age) * (1 - d);
      if (here > worst) worst = here;
    }
    return worst;
  };

  /**
   * Redraws one patch, row by row, following the ellipse rather than its
   * bounding box. A box costs its full width on every row, including the
   * ones where the ellipse is only a few cells across, and at a third of
   * the picture three of them came to most of the grid.
   *
   * The clear is padded horizontally but not vertically: rows are eight
   * pixels tall so vertical padding would reach into the neighbours, and
   * no character in the ramp has a descender to protect.
   */
  const spans: {
    y: number;
    /** One trimmed run per lane, `null` where that lane is empty. */
    runs: Array<{ x: number; text: string } | null>;
  }[] = [];

  const repaintPatch = (patch: Patch, time: number) => {
    spans.length = 0;

    // Clamped to the crop as well as to the grid: a patch that reaches
    // past the frame has nothing to disturb out there.
    const top = Math.max(rowFrom, Math.floor(patch.cy - patch.ry) - 1);
    const bottom = Math.min(rowTo, Math.ceil(patch.cy + patch.ry) + 1);

    for (let y = top; y <= bottom; y++) {
      const dy = (y - patch.cy) / patch.ry;
      const inside = 1 - dy * dy;
      if (inside <= 0) continue;

      const half = patch.rx * Math.sqrt(inside);
      const x0 = Math.max(colFrom, Math.floor(patch.cx - half) - 1);
      const x1 = Math.min(colTo, Math.ceil(patch.cx + half) + 1);
      if (x1 < x0) continue;
      const width = x1 - x0 + 1;

      ctx.clearRect(
        x0 * cellW - 2,
        (y * cellH) | 0,
        width * cellW + 4,
        Math.ceil(cellH) + 1,
      );

      for (let b = 0; b < 4; b++) lane[b].fill(' ', 0, width);

      for (let x = x0; x <= x1; x++) {
        const i = y * cols + x;
        const ink = glyphs[i];
        if (ink === 0) continue;
        const at = x - x0;

        const s = disturbance(x, y, time);
        // Only a share of the cells inside a patch are ever disturbed at
        // once, and which ones is fixed per cell. That is where the
        // randomness comes from: the region does not dissolve evenly, it
        // comes apart in speckles, the way something actually breaks.
        if (s <= 0.04 || hash(i * 31 + 7) > s) {
          lane[bucketOf(ink)][at] = RAMP[ink];
          continue;
        }

        // Quantised so the flicker runs at its own slow rate rather than
        // changing every frame, which reads as noise instead of motion.
        const noise = hash(i * 7919 + Math.floor(time * 11));
        const reach = 1 + Math.floor(noise * (RAMP.length - 1));
        lane[s > 0.5 ? 0 : 1][at] = RAMP[Math.min(RAMP.length - 1, reach)];
      }

      // Bounded to `width`, because the lanes are allocated at full grid
      // width and reused: reading past this row's span would drag in
      // whatever characters a wider row left behind.
      const base = x0 * cellW;
      spans.push({
        y: (y * cellH) | 0,
        runs: [
          runOf(lane[0], 0, width - 1, base),
          runOf(lane[1], 0, width - 1, base),
          runOf(lane[2], 0, width - 1, base),
          runOf(lane[3], 0, width - 1, base),
        ],
      });
    }

    // Drawn bucket-first so the whole patch costs four `fillStyle`
    // changes rather than four per row.
    for (let b = 0; b < 4; b++) {
      ctx.fillStyle = styles[b];
      for (let s = 0; s < spans.length; s++) {
        // Only a share of a patch's cells are ever speckled at once, so
        // lanes 0 and 1 are empty on most rows. Skipping those rows drops
        // the draw calls for output that is identical.
        const run = spans[s].runs[b];
        if (run) ctx.fillText(run.text, run.x, spans[s].y);
      }
    }
  };

  /**
   * Places a patch inside the crop, not inside the grid. Scattered over the
   * whole picture, four patches in five landed outside the frame on a phone
   * and the idle read as nothing happening at all.
   */
  const spawnPatch = (elapsed: number) => {
    patches.push({
      cx: colFrom + hash(Math.floor(elapsed * 977)) * (colTo - colFrom),
      cy: rowFrom + hash(Math.floor(elapsed * 613) + 5) * (rowTo - rowFrom),
      // Wide. A patch that covers a third of the picture reads as the
      // painting itself coming apart; the small ones only ever read as
      // a blemish somewhere on it. The cost of the bigger area is
      // absorbed by the radial falloff — most of the cells it spans are
      // barely disturbed at all.
      rx: 34 + hash(Math.floor(elapsed * 131) + 9) * 62,
      ry: 15 + hash(Math.floor(elapsed * 271) + 3) * 26,
      born: elapsed,
      // Longer than the small patches needed. An area this size taking
      // two seconds to come apart and back reads as a glitch; taking
      // five reads as the picture breathing.
      life: 3.6 + hash(Math.floor(elapsed * 89) + 1) * 2.8,
    });
  };

  /** Repaints every live patch, dropping the ones whose life has run out. */
  const stepPatches = (elapsed: number) => {
    for (let p = patches.length - 1; p >= 0; p--) {
      const patch = patches[p];
      const dead = elapsed - patch.born >= patch.life;
      // A dead patch still gets one last repaint, which is what restores
      // its cells to the painting. Dropping it a frame earlier would
      // leave the speckles frozen where they were.
      repaintPatch(patch, elapsed);
      if (dead) patches.splice(p, 1);
    }
  };

  return {
    measure,
    paint,
    spawnPatch,
    stepPatches,
    patchCount: () => patches.length,
  };
}

interface Patch {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  born: number;
  life: number;
}
