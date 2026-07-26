'use client';

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
} from 'motion/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { POINTER_ORIGIN } from './pointer-origin';

/**
 * The headline's caret, become a pointer.
 *
 * ── One shape, not two ──────────────────────────────────────────────────────
 *
 * The claim at the top of the page ends in a text caret: a lime bar, blinking
 * while the phrase holds. That bar is this. At 2.5s it stops being drawn there
 * and starts being drawn here, at the same position and the same size on the
 * same frame, and then it leaves the line and unfolds into an arrow on the way
 * down to the product.
 *
 * Both shapes are the same four points. A caret is a rectangle: top-left,
 * top-right, bottom-right, bottom-left. A pointer is a quadrilateral: tip,
 * blade, notch, tail. Corresponded in that order and interpolated, the bar's
 * top-left stays put as the tip, its right edge swings out into the blade, and
 * its bottom drops away into the tail. There is one path on the page
 * throughout, and only its corners move.
 *
 * That is also why it is a path rather than a `div` and an SVG: four points
 * interpolating is a morph, and a div cross-fading into an SVG is the thing
 * being avoided.
 *
 * ── Why the caret ───────────────────────────────────────────────────────────
 *
 * It is the one thing on the page already moving when the reader arrives, so it
 * is where they are looking. Everything after this is the pointer spending that
 * attention on the product. Leaving from the wordmark in the nav was tried and
 * is worse for the obvious reason: nobody is looking at the nav.
 *
 * The headline gets a caret back a few seconds later, on a plain fade, once the
 * pointer is far away and busy. It is not the same object and it does not
 * pretend to be — see `pointer-origin.ts` for the two attempts at making it one
 * and why neither survived contact with a browser.
 *
 * ── It never goes home ──────────────────────────────────────────────────────
 *
 * The pointer is born once. After that it stays in the panel and works round
 * the screens forever, and each pass starts from wherever the last one left it
 * rather than from the headline. A loop that returned to its origin would
 * replay the descent every twenty seconds, which turns the one gesture on this
 * page worth watching into a tic.
 *
 * ── Slow ────────────────────────────────────────────────────────────────────
 *
 * Every pass at this that tried to be efficient read as something being fired
 * at the panel. The descent takes two and a half seconds and the hops between
 * controls are about twice as slow as a real hand.
 *
 * ── Lime, and nothing else ──────────────────────────────────────────────────
 *
 * Solid fill, lightly eased corners, a thin dark keyline, one soft shadow. The
 * corners come from stroking the shape in its own colour with a round join,
 * which is also what lets the bar have soft ends without being a different
 * shape from the arrow — so the amount of rounding and the amount the mark is
 * inflated by are the same number, and it is kept small.
 *
 * The keyline earns its place on this page rather than by convention. The
 * pointer's most frequent target is the rail's active row, which the app draws
 * as a solid primary fill, and lime landing on lime has to be separated by
 * something; it also crosses pale chart tiles, where a light rim would vanish.
 * A dark line survives both.
 *
 * The keyline and the shadow both fade in with the morph. A text caret is text:
 * it has neither, and a bar sitting in a headline with a drop shadow under it
 * is the tell that it is not really part of the line.
 */

/** The design the screens are authored at, and this aims against. */
const DESIGN_W = 1240;
const DESIGN_H = 840;

export interface Point {
  x: number;
  y: number;
}

type Quad = [Point, Point, Point, Point];

/**
 * The pointer, tip at the origin, in the composition's own pixels.
 *
 * The proportions are most of the style, and this has been widened twice. The
 * mark is 27 across against 34 tall, a ratio of about 1.26, where the first
 * pass was 1.8 and the second 1.4. A tall, narrow arrow with a shallow tip
 * angle is a needle rather than something you point with, and the silhouette is
 * what the eye reads before it reads any colour.
 *
 * The tip opens to about 33 degrees: the left edge sits 17 degrees off vertical
 * and the blade comes down at just under 50.
 */
const ARROW: Quad = [
  { x: 0, y: 0 },
  { x: 27, y: 23 },
  { x: 16.2, y: 24 },
  { x: 10.4, y: 34 },
];

/**
 * Stroke at each end of the morph.
 *
 * This is what rounds the corners, and it used to be 3.6, which is a lot: a
 * round join inflates the silhouette by half the stroke in every direction and
 * softens each corner by the same amount, so the mark was reading as a lozenge
 * with a point on it rather than as an arrow. At 1.8 the corners are eased
 * rather than rounded off, and the geometry above carries the size itself
 * instead of being fattened into it.
 */
const EDGE_BAR = 1;
const EDGE_ARROW = 1.8;

/**
 * How far the keyline stands out past the fill.
 *
 * Dark rather than pale. Lime on the rail's active row is lime on lime and
 * needs separating either way; a near-black line does it more decisively than a
 * white one, and it holds up over the pale surfaces on the charts as well,
 * where a white rim disappears into the tile.
 *
 * 2.6 against a 1.8 fill leaves about 1.3 of line on each side, which is a
 * keyline and not a border.
 */
const RIM = 2.6;

/** Slowest and fastest an ordinary hop may be, and the distance between them. */
const NEAR = 0.85;
const FAR = 1.45;
const SPAN = 900;

/**
 * The glide.
 *
 * Gently in and long out. A curve that leaves instantly is what makes motion
 * read as snapping to a target; one that takes a moment to get going reads as
 * drifting, which is the quality being asked for.
 */
const GLIDE = [0.42, 0, 0.18, 1] as const;

/** How long the button is held down. */
export const PRESS = 0.14;

/** Time to cross from one target to another. */
export function travelTime(from: Point, to: Point): number {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return NEAR + Math.min(distance / SPAN, 1) * (FAR - NEAR);
}

interface Frame {
  w: number;
  h: number;
  /** The caret's top-left, in this box's own untransformed pixels. */
  origin: Point;
  /** The caret's painted size, in the same pixels. */
  caret: { w: number; h: number };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The four corners of the caret, tip-anchored like the arrow. */
function bar(size: { w: number; h: number }): Quad {
  const inset = EDGE_BAR / 2;
  return [
    { x: inset, y: inset },
    { x: size.w - inset, y: inset },
    { x: size.w - inset, y: size.h - inset },
    { x: inset, y: size.h - inset },
  ];
}

function quadPath([a, b, c, d]: Quad): string {
  return `M${a.x.toFixed(2)},${a.y.toFixed(2)}L${b.x.toFixed(2)},${b.y.toFixed(2)}L${c.x.toFixed(2)},${c.y.toFixed(2)}L${d.x.toFixed(2)},${d.y.toFixed(2)}Z`;
}

/**
 * Measures the box the targets map into, and the caret it is taking over from.
 *
 * Both conversions are needed rather than a plain read. `getBoundingClientRect`
 * reports screen pixels *after* every ancestor transform, and this box has two
 * of them: the panel's entrance and the scroll pull-back. The pointer moves in
 * the box's own untransformed space, so the screen-space offset and the caret's
 * size are both divided back out by the scale the box is currently drawn at.
 *
 * Measured once, on mount, which is the only moment it matters: the pointer
 * leaves the caret on that frame and never comes back to it.
 */
function useFrame(ref: React.RefObject<HTMLDivElement | null>): Frame | null {
  const [frame, setFrame] = useState<Frame | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const box = element.getBoundingClientRect();
      const scale =
        element.clientWidth > 0 ? box.width / element.clientWidth : 1;

      const mark = document.querySelector(`[${POINTER_ORIGIN}]`);
      const spot = mark?.getBoundingClientRect();
      // Layout box rather than painted rectangle: what has to match is the
      // space the caret occupies in the line.
      const layout = mark instanceof HTMLElement ? mark : null;

      const caret =
        layout && spot
          ? { w: layout.offsetWidth / scale, h: layout.offsetHeight / scale }
          : { w: 4, h: 46 };

      // No caret on the page is not worth breaking over: the pointer starts
      // above the panel at a plausible size and everything after is identical.
      const origin: Point = spot
        ? { x: (spot.left - box.left) / scale, y: (spot.top - box.top) / scale }
        : { x: element.clientWidth * 0.5, y: -element.clientHeight * 0.3 };

      setFrame({
        w: element.clientWidth,
        h: element.clientHeight,
        origin,
        caret,
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return frame;
}

export function Cursor({
  at,
  pressed,
  duration,
}: {
  /** The target, in the app's design pixels. */
  at: Point;
  pressed: boolean;
  /** Seconds for the current hop. */
  duration: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useFrame(ref);

  /*
    The morph, 0 at the caret and 1 as a pointer.

    Driven imperatively rather than declared, because it does not share a
    duration with the travel: it has to be finished well before the pointer
    arrives, or the reader watches a bar press a button. It runs once, on the
    descent, and is never asked to come back.
  */
  const shape = useMotionValue(0);

  useLayoutEffect(() => {
    const controls = animate(shape, 1, {
      duration: duration * 0.55,
      ease: GLIDE,
    });
    return () => controls.stop();
  }, [shape, duration]);

  const caret = frame?.caret ?? { w: 4, h: 46 };

  const d = useTransform(shape, (t) =>
    quadPath(
      bar(caret).map((point, i) => ({
        x: lerp(point.x, ARROW[i].x, t),
        y: lerp(point.y, ARROW[i].y, t),
      })) as Quad,
    ),
  );
  const edge = useTransform(shape, (t) => lerp(EDGE_BAR, EDGE_ARROW, t));
  const rimEdge = useTransform(shape, (t) =>
    lerp(EDGE_BAR, EDGE_ARROW + RIM, t),
  );
  const rimOpacity = useTransform(shape, [0, 0.45, 1], [0, 0, 0.92]);
  const shadow = useTransform(
    shape,
    (t) =>
      `drop-shadow(0 ${(3 * t).toFixed(2)}px ${(8 * t).toFixed(2)}px rgba(0,0,0,${(0.5 * t).toFixed(2)}))`,
  );

  // The first paint measures; the second draws. A frame's delay is invisible
  // two and a half seconds into the page, and the alternative is animating from
  // the origin of a box whose size is not known yet.
  if (!frame) {
    return (
      <div
        ref={ref}
        aria-hidden
        className="pointer-events-none absolute inset-0"
      />
    );
  }

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0">
      <motion.div
        className="absolute left-0 top-0"
        // Applied once, on mount: exactly where the caret is, exactly its size.
        // Nothing fades in, because on this frame this *is* the caret.
        initial={{ x: frame.origin.x, y: frame.origin.y }}
        animate={{
          x: (at.x / DESIGN_W) * frame.w,
          y: (at.y / DESIGN_H) * frame.h,
        }}
        transition={{
          /*
            The two axes are given different durations, and that is the whole
            trick behind the path looking like a hand rather than a ruler.
            Interpolated over the same span, x and y draw a straight line
            between two points; letting the vertical run a little longer bends
            it into a shallow arc. Nobody notices it, and it is the difference
            between drifting and being dragged.
          */
          x: { duration, ease: GLIDE },
          y: { duration: duration * 1.14, ease: GLIDE },
        }}
      >
        {/* Centred on the tip and under the shape, so a press appears to come
            from the point rather than from the graphic. */}
        <AnimatePresence>
          {pressed ? (
            <motion.span
              key="ring"
              className="absolute -left-5 -top-5 size-10 rounded-full border border-primary"
              initial={{ scale: 0.25, opacity: 0.8 }}
              animate={{ scale: 1.9, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.75, ease: 'easeOut' }}
            />
          ) : null}
        </AnimatePresence>

        <motion.svg
          width="40"
          height="40"
          viewBox="0 0 40 40"
          fill="none"
          className="relative block"
          // One unit is one pixel, and the shape is allowed out of the box: the
          // caret is taller than 40 units at this type size, and clipping to the
          // viewBox would cut the bar in half on the first frame.
          style={{ overflow: 'visible', filter: shadow }}
          animate={{ scale: pressed ? 0.88 : 1 }}
          transition={
            pressed
              ? { duration: PRESS, ease: 'easeOut' }
              : { type: 'spring', stiffness: 340, damping: 20 }
          }
        >
          <title>Pointer</title>
          {/* The rim is the same path stroked wider and drawn behind, so the
              two silhouettes are the same shape by construction and cannot
              drift out of register during the morph. */}
          <motion.path
            d={d}
            fill="none"
            stroke="oklch(0.12 0 0)"
            strokeWidth={rimEdge}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ opacity: rimOpacity }}
          />
          <motion.path
            d={d}
            fill="var(--primary)"
            stroke="var(--primary)"
            strokeWidth={edge}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </motion.svg>
      </motion.div>
    </div>
  );
}
