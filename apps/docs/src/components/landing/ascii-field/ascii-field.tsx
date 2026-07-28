'use client';

import { useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { buildGrid, FONT, SETTLE, SPREAD } from './grid';
import { createRenderer } from './renderer';

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
  // Written during render on purpose: the animation loop reads this rather
  // than closing over `active`, so arming the band does not restart the
  // fetch or re-enter the effect. Reading it in render is what would be
  // unsafe; writing the latest value is the documented pattern.
  const armed = useRef(active);
  // react-doctor-disable-next-line react-doctor/no-ref-current-in-render
  armed.current = active;
  /**
   * Whether the band has been on screen yet. The hero's is visible at once, so
   * this is only load-bearing for the ones further down: without it their
   * reveal would run and finish long before anyone scrolled to them.
   */
  const seen = useRef(false);
  /** Live, unlike `seen`: the idle loop stops the moment the band leaves. */
  const visible = useRef(false);

  /*
    Two suppressions, both about paths rather than about the teardown.

    The cleanup is real and at the bottom: it cancels the frame, drops the
    observers and flips `cancelled` so a fetch landing after unmount does
    nothing. What the rule sees are the early returns above it, taken when
    there is no canvas or no 2D context — where nothing has been started.

    The fetch belongs here too. It pulls a static text asset for a
    decorative canvas that is gated on the band being scrolled into view;
    there is no server-rendered form of a canvas, and hoisting it would
    load three paintings on every visit whether or not they are reached.
  */
  // react-doctor-disable-next-line react-doctor/effect-needs-cleanup
  // react-doctor-disable-next-line react-doctor/no-fetch-in-effect
  useEffect(() => {
    const canvas = ref.current;
    const container = box.current;
    if (!canvas || !container) return;

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
    watcher.observe(container);

    let cancelled = false;
    let raf = 0;
    /* Created once the grid has been fetched and measured, so it is declared
       out here purely to be disconnectable from the teardown below. */
    let sizer: ResizeObserver | null = null;

    fetch(asset(source))
      .then((response) => (response.ok ? response.text() : null))
      .then((text) => {
        if (cancelled || !text) return;

        const font = `${FONT}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.font = font;
        const cellW = ctx.measureText('M').width || FONT * 0.6;

        const grid = buildGrid(text, cellW);
        if (!grid) return;

        canvas.width = Math.ceil(grid.cols * cellW);
        canvas.height = Math.ceil(grid.rowCount * grid.cellH);
        // Resizing a canvas resets its 2D state, so the font is set again.
        ctx.font = font;
        ctx.textBaseline = 'top';

        const field = createRenderer(ctx, canvas, container, grid, intensity);
        field.measure();

        if (reduced) {
          field.paint(null);
          return;
        }

        const duration = SPREAD + SETTLE;
        let origin = 0;
        let last = 0;
        let resolved = false;
        let nextPatch = 0;

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
          if (field.measure() && resolved) field.paint(null);
        });
        sizer.observe(container);

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
              field.paint(null);
              return;
            }
            if (now - last >= FRAME) {
              last = now;
              field.paint(elapsed);
            }
            return;
          }

          /* --- idle --- */
          // Nothing runs while the band is off screen or the tab is in the
          // background. Coming back picks up wherever the clock got to.
          if (!visible.current || document.hidden) return;
          if (now - last < IDLE_FRAME) return;
          last = now;

          if (elapsed > nextPatch && field.patchCount() < MAX_PATCHES) {
            field.spawnPatch(elapsed);
            nextPatch = elapsed + PATCH_GAP * (0.55 + Math.random() * 0.9);
          }

          field.stepPatches(elapsed);
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
