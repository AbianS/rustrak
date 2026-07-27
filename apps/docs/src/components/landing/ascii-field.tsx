'use client';

import { useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * A painting, as ASCII, condensing out of noise.
 *
 * Pre-rendered, not live. Converting in the browser every frame capped both the
 * resolution (the grid had to be small enough to re-derive 24 times a second)
 * and the algorithm, and coarse is fatal here — a painting needs cells to be
 * recognisable in. The conversion happens once, offline, and what ships is the
 * finished text. Being free of a frame budget is what lets the offline pass use
 * clip-limited local contrast and a 3× supersample from a 3840px scan.
 *
 * Two things learned the hard way, for whoever regenerates these: short ramps
 * beat long ones (the canonical 70-character ramp is not ordered by ink
 * coverage in any real font, so it renders as noise), and tone or edges, never
 * both.
 *
 * The grids are cropped short of their full row count, which is a repair rather
 * than a framing preference. A painting in one-point perspective puts a
 * near-perfect horizontal across the picture — in The Last Supper the front
 * edge of the table, where mean ink drops 2.4 levels in a single row — and as a
 * background that reads as a seam, a hard rule across the viewport with a
 * darker half beneath it. No mask can remove a step, only dim one, so the crop
 * puts the step where the mask has already all but faded. The ratio is the
 * durable part, not the row numbers: `scripts/ascii-painting.mjs` prints a
 * "sharpest horizontal steps" line for exactly this.
 *
 * The reveal condenses rather than fades: every cell begins as a random glyph
 * flickering at the faintest tone, then settles onto the character that belongs
 * there, spreading outward from the centre with per-cell jitter so the front
 * does not read as a clean expanding ring. Fading finished glyphs in says "an
 * image is arriving"; glyphs locking into place says "this is being resolved".
 *
 * That scramble is the only expensive thing here, so it is bounded: the loop
 * repaints at 30fps for about three seconds, paints the final state once, and
 * stops for good. After that there is no per-frame JavaScript at all.
 *
 * It also only works on the part that is on screen. The canvas is a 2.3:1 strip
 * shown with `object-fit: cover`, so a portrait box crops the width hard — on a
 * 390 × 844 screen only 20.5% of the columns are inside the frame. The loop
 * solves the crop first and works in columns. Not a mobile special case: a
 * 1440 × 1200 monitor saves about half. Every cell's delay is still computed
 * against the full grid, so rotating into a wider frame shows exactly the
 * picture it would have shown.
 */

const SOURCE = '/last-supper.txt';

/**
 * `basePath` rewrites `<Link>`, `next/image` and imported assets, but not a
 * string handed to `fetch`. On GitHub Pages the site is served from
 * `/rustrak/`, so an absolute `/last-supper.txt` resolves against the domain
 * root and 404s, leaving the painting blank with no error on the page.
 */
const asset = (path: string) => {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  return path.startsWith('/') ? `${base}${path}` : path;
};

/** The ramp the offline pass used. Index here means ink, and drives colour. */
const RAMP = ' .`:;+*oOX#%@';

/** Ramp index at which a character moves up a colour bucket. */
const MID = 5;
const HOT = 9;

/**
 * Painting size, in CSS pixels. Not tied to the viewport: the canvas is drawn
 * once at its natural size and then scaled by CSS, so this only decides how
 * much bitmap the glyphs get.
 */
const FONT = 8;
const LEADING = 1.02;

/** Seconds between the first cell settling and the last one starting. */
const SPREAD = 2.2;
/** Seconds one cell spends flickering before it locks onto its glyph. */
const SETTLE = 0.55;
/** Frame interval during the reveal, ms. */
const FRAME = 33;

/**
 * Frame interval for the idle disturbances, ms.
 *
 * Slower than the reveal on purpose. The idle is meant to be caught out of the
 * corner of the eye, and a lower rate makes the speckling read as something
 * coming apart rather than as a shimmer.
 */
const IDLE_FRAME = 60;
/** Disturbances alive at once. More than a few and the picture never settles. */
const MAX_PATCHES = 3;
/** Rough seconds between one starting and the next. */
const PATCH_GAP = 2.4;

/** Deterministic per-cell noise. Stable for delays, per-frame for scramble. */
function hash(n: number): number {
  let h = n ^ 61 ^ (n >>> 16);
  h = h + (h << 3);
  h = h ^ (h >>> 4);
  h = Math.imul(h, 0x27d4eb2d);
  h = h ^ (h >>> 15);
  return (h >>> 0) / 4294967296;
}

export function AsciiField({
  source = SOURCE,
  className,
  active = true,
  intensity = 1,
  scrim = false,
}: {
  /** Pre-rendered ASCII, as produced by the offline pass. */
  source?: string;
  /** Where the band sits and how tall it is. The caller owns the layout. */
  className?: string;
  /** Held false until the page has started, so the reveal is not spent unseen. */
  active?: boolean;
  /**
   * Multiplies every tone. Bands behind the product panel are turned down so
   * they read as depth rather than competing with the screen in front of them.
   */
  intensity?: number;
  /** Pools darkness under the headline. Only the top band needs it. */
  scrim?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  // Read inside the animation loop rather than closed over, so arming it does
  // not restart the fetch or re-enter the effect.
  const armed = useRef(active);
  armed.current = active;
  /**
   * Whether the band has been on screen yet. The hero's is visible at once, so
   * this is only load-bearing for the ones further down: without it their
   * reveal would run and finish long before anyone scrolled to them.
   */
  const seen = useRef(false);
  /** Live, unlike `seen`: the idle loop stops the moment the band leaves. */
  const visible = useRef(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const watcher = new IntersectionObserver(
      (entries) => {
        const showing = entries[0]?.isIntersecting ?? false;
        visible.current = showing;
        if (showing) seen.current = true;
      },
      { threshold: 0 },
    );
    if (box.current) watcher.observe(box.current);

    let cancelled = false;
    let raf = 0;
    /* Created once the grid has been fetched and measured, so it is declared
       out here purely to be disconnectable from the teardown below. */
    let sizer: ResizeObserver | null = null;

    fetch(asset(source))
      .then((response) => (response.ok ? response.text() : null))
      .then((text) => {
        if (cancelled || !text) return;

        const rows = text.split('\n').filter((row) => row.length > 0);
        if (rows.length === 0) return;
        const cols = rows[0].length;
        const count = cols * rows.length;

        const font = `${FONT}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.font = font;
        const cellW = ctx.measureText('M').width || FONT * 0.6;
        const cellH = FONT * LEADING;

        canvas.width = Math.ceil(cols * cellW);
        canvas.height = Math.ceil(rows.length * cellH);
        // Resizing a canvas resets its 2D state, so the font is set again.
        ctx.font = font;
        ctx.textBaseline = 'top';

        /* ---- per-cell target and schedule ---- */
        const glyphs = new Uint8Array(count); // ramp index, 0 = never drawn
        const delay = new Float32Array(count);

        for (let y = 0; y < rows.length; y++) {
          const row = rows[y];
          for (let x = 0; x < cols; x++) {
            const i = y * cols + x;
            const ink = RAMP.indexOf(row[x]);
            glyphs[i] = ink > 0 ? ink : 0;

            // Outward from the centre, corrected for the cell's own aspect so
            // the front is round on screen rather than round in grid space.
            const dx = (x / cols - 0.5) * 2;
            const dy =
              ((y / rows.length - 0.5) * 2 * cellH * rows.length) /
              (cellW * cols);
            const radius = Math.min(1, Math.hypot(dx, dy) / 1.15);
            delay[i] = (radius * 0.72 + hash(i) * 0.28) * SPREAD;
          }
        }

        /* ---- painting ---- */
        // Four tones while resolving: the first is the flicker, barely there,
        // so the grid reads as static condensing rather than as glyphs fading.
        const lime = (alpha: number, warm = false) =>
          `rgba(${warm ? '226, 255, 140' : '197, 241, 30'}, ${(
            alpha * intensity
          ).toFixed(3)})`;
        const GHOST = lime(0.09);
        const TONES = [lime(0.22), lime(0.46), lime(0.78, true)];
        const styles = [GHOST, ...TONES];

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
        let rowTo = rows.length - 1;

        const measure = () => {
          const rect = box.current?.getBoundingClientRect();
          if (!rect || rect.width === 0 || rect.height === 0) return false;

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
            rows.length - 1,
            Math.ceil((canvas.height / 2 + halfH) / cellH) + 1,
          );

          const changed =
            from !== colFrom ||
            to !== colTo ||
            top !== rowFrom ||
            bottom !== rowTo;
          colFrom = from;
          colTo = to;
          rowFrom = top;
          rowTo = bottom;
          return changed;
        };

        measure();

        const bucketOf = (ink: number) => (ink >= HOT ? 3 : ink >= MID ? 2 : 1);

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
              lane[t < 0.55 ? 0 : 1][x] =
                RAMP[Math.min(RAMP.length - 1, reach)];
            }

            for (let b = 0; b < 4; b++)
              out[b].push(runOf(lane[b], colFrom, colTo));
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
              if (run)
                ctx.fillText(run.text, run.x, ((y + rowFrom) * cellH) | 0);
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
        interface Patch {
          cx: number;
          cy: number;
          rx: number;
          ry: number;
          born: number;
          life: number;
        }
        const patches: Patch[] = [];
        let nextPatch = 0;

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
              lane[s > 0.5 ? 0 : 1][at] =
                RAMP[Math.min(RAMP.length - 1, reach)];
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

        if (reduced) {
          paint(null);
          return;
        }

        const duration = SPREAD + SETTLE;
        let origin = 0;
        let last = 0;
        let resolved = false;

        /*
          The crop is a function of the element's size, so it has to be
          re-solved when that changes — a rotation, a desktop window dragged
          wider, a phone's URL bar collapsing.

          Widening is the case that needs the repaint: columns outside the old
          window were never painted, so without one they would come into frame
          blank. While the reveal is running the next frame covers it anyway;
          once the picture has resolved there is no next frame, which is the
          only reason this asks rather than just re-measuring.
        */
        sizer = new ResizeObserver(() => {
          if (measure() && resolved) paint(null);
        });
        if (box.current) sizer.observe(box.current);

        const loop = (now: number) => {
          if (cancelled) return;
          raf = requestAnimationFrame(loop);

          // Two gates, both cheap: the page has to have started, and the band
          // has to have been on screen at least once. Without the second, every
          // band below the fold resolves while nobody is looking at it.
          if (!armed.current || !seen.current) return;
          if (origin === 0) origin = now;

          const elapsed = (now - origin) / 1000;

          /* --- the reveal --- */
          if (!resolved) {
            if (elapsed >= duration) {
              resolved = true;
              paint(null);
              return;
            }
            if (now - last >= FRAME) {
              last = now;
              paint(elapsed);
            }
            return;
          }

          /* --- idle --- */
          // Nothing runs while the band is off screen or the tab is in the
          // background. Coming back picks up wherever the clock got to.
          if (!visible.current || document.hidden) return;
          if (now - last < IDLE_FRAME) return;
          last = now;

          if (elapsed > nextPatch && patches.length < MAX_PATCHES) {
            patches.push({
              // Placed inside the crop, not inside the grid. Scattered over the
              // whole picture, four patches in five landed outside the frame on
              // a phone and the idle read as nothing happening at all.
              cx: colFrom + hash(Math.floor(elapsed * 977)) * (colTo - colFrom),
              cy:
                rowFrom +
                hash(Math.floor(elapsed * 613) + 5) * (rowTo - rowFrom),
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
            nextPatch = elapsed + PATCH_GAP * (0.55 + Math.random() * 0.9);
          }

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
        raf = requestAnimationFrame(loop);
      })
      .catch(() => {
        // A background that fails to load is a background that is not there.
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      watcher.disconnect();
      sizer?.disconnect();
    };
  }, [reduced, source, intensity]);

  return (
    <div
      ref={box}
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 overflow-hidden',
        className,
      )}
    >
      {/*
        ── Covered, not fitted ─────────────────────────────────────────────────

        The grid is 470 × 123 cells, and cells are not square: the mono advance
        is 0.6em against a 1.02 leading, so the bitmap comes out around
        2256 × 1004 — a 2.3:1 strip.

        This used to be sized by a width percentage with the height left
        automatic, which fixed its height at `width / ratio` and left it unable
        to fill a box any taller than that. On a wide desktop it happened to
        overflow and looked fine; on anything tall it fell short, worst on the
        shape most visitors hold:

            390 × 844 phone at 230%  ->  897 × 507px, 337px short
            1440 × 1200 monitor      ->  1814 × 1026px, 174px short

        Overscanning the width harder was the workaround, and it could not work:
        widening the strip pushes the surplus off the left and right edges
        without adding a single pixel of height.

        There was a second, quieter failure. The mask below is authored in
        percentages, and percentages resolve against the element they are on —
        so when the canvas was a strip floating inside the band, "fade out from
        72%" meant 72% of the strip, landing at a different place on the screen
        at every viewport.

        `object-fit: cover` fixes both at once. A canvas is a replaced element,
        so it honours it; the canvas now fills the band exactly at every size,
        which makes the mask's stops fractions of the band and therefore stable.
        The trade-off is real: covering a tall box from a 2:1 source crops
        horizontally, so less of the table is in frame than on a wide monitor
        before. `object-position: center` keeps that crop on the composition's
        focal point, which is where the source puts it anyway.

        ── Two elements, not one ───────────────────────────────────────────────

        The drift and the mask used to sit on the canvas together, and that
        combination is the expensive one: a mask has to be reapplied every time
        the element it is on changes, so a masked element that is permanently
        scaling is a surface this size the compositor may never treat as
        settled. Split apart, the canvas is a static masked layer and the wrapper
        is a bare transform over it — the one thing a compositor does without
        help.

        The drift is a CSS animation rather than a Motion one for a second
        reason. Motion's frame loop only sleeps when nothing is animating, and a
        54-second `repeat: Infinity` meant it never did: the whole scheduler
        stayed awake for the life of the page to move one element a hundredth of
        a screen. CSS hands that to the compositor and asks nothing of JS.
      */}
      <div className="ascii-drift absolute inset-0">
        <canvas
          ref={ref}
          className="block h-full w-full object-cover object-center"
          style={{
            // Reaches the very bottom now rather than stopping at 98%. The
            // stops are relative to this element, which is the whole band since
            // the canvas covers it — so they read as fractions of the screen
            // instead of fractions of a floating strip.
            maskImage:
              'linear-gradient(to bottom, transparent, black 12%, black 72%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent, black 12%, black 72%, transparent 100%)',
          }}
        />
      </div>

      {/*
        The scrim, between the picture and the type. This is what makes it
        possible for the painting to be drawn at strength: rather than dimming
        the whole background so the headline survives, the darkness is pooled
        exactly where type sits and the rest of the picture is left alone.

        Two pools, because there are two things to protect. The linear one runs
        under the nav bar — 64px of chrome that has to stay readable against
        whatever part of the painting happens to be behind it, and since the
        field is pinned that is a different part at every scroll position. The
        radial one sits under the headline.

        Both live in `globals.css` rather than here, because the pool under the
        headline has to change shape with the headline: the same sentence that
        sets on two lines on a monitor takes four on a phone, over a painting
        that is cropped much harder there. A gradient authored for the first
        case leaves the last two lines sitting on bare fresco.
      */}
      {scrim ? <div className="ascii-scrim absolute inset-0" /> : null}
    </div>
  );
}
