import { useEffect, useRef } from 'react';

const ROWS = 12;
const COLUMNS = 34;
const CELL_GAP = 3;
const CELL_RADIUS = 1.5;
/** How long the field takes to draw itself in, in milliseconds. */
const INTRO = 900;
/** How far the cursor reaches, as a multiple of the cell pitch. */
const CURSOR_REACH = 5.5;

/** Read from tokens once per mount, so the art cannot drift from the palette. */
interface Colors {
  brand: string;
  grid: string;
}

/** Where the pointer is, in CSS pixels from the canvas corner. */
interface Cursor {
  x: number;
  y: number;
  strength: number;
  target: number;
}

/** The grid in CSS pixels, recomputed per frame because the panel resizes. */
interface Layout {
  pitchX: number;
  pitchY: number;
  cellW: number;
  cellH: number;
  reach: number;
}

/** What every cell of one frame shares. */
interface Tick {
  seconds: number;
  intro: number;
  still: boolean;
}

/**
 * Resting heat, 0 to 1. Sines rather than value noise because incidents
 * cluster: a bad deploy is a smear across a week, not one cell. The 2.4
 * curve is what keeps most of the field dark and a few cells hot.
 */
function restingHeat(row: number, column: number): number {
  const waves =
    0.5 +
    0.3 * Math.sin(column * 0.32 + row * 0.18) +
    0.22 * Math.sin(column * 0.11 - row * 0.41 + 1.7) +
    0.16 * Math.sin(column * 0.63 + row * 0.52 + 4.2);

  return Math.min(1, Math.max(0, waves)) ** 2.4;
}

/** `0` at rest, briefly `1`: fast attack, long decay. */
function spike(row: number, column: number, seconds: number): number {
  // Hashed phase, so ignitions scatter instead of marching in step.
  const phase = ((row * 73856093) ^ (column * 19349663)) % 997;
  const cycle = (seconds * 0.14 + Math.abs(phase) / 997) % 1;

  if (cycle > 0.06) return 0;
  return cycle < 0.012 ? cycle / 0.012 : 1 - (cycle - 0.012) / 0.048;
}

function layoutOf(width: number, height: number): Layout {
  const pitchX = (width + CELL_GAP) / COLUMNS;
  const pitchY = (height + CELL_GAP) / ROWS;

  return {
    pitchX,
    pitchY,
    cellW: pitchX - CELL_GAP,
    cellH: pitchY - CELL_GAP,
    reach: CURSOR_REACH * pitchX,
  };
}

/** Diagonal sweep: drawn the way it is read, oldest week first. */
function cellEntered(row: number, column: number, tick: Tick): number {
  if (tick.still) return 1;

  const arrival = (column / COLUMNS) * 0.7 + (row / ROWS) * 0.3;
  return Math.min(1, Math.max(0, (tick.intro - arrival * 0.6) * 3));
}

/**
 * Heat before the cursor touches it. The breathing is slow enough that you
 * never catch it moving: faster reads as a loading state.
 */
function cellHeat(row: number, column: number, tick: Tick): number {
  const base = restingHeat(row, column);
  if (tick.still) return base;

  const wave =
    0.55 + 0.45 * Math.sin(tick.seconds * 0.7 - column * 0.19 - row * 0.1);

  return Math.min(
    1,
    base * wave + base * spike(row, column, tick.seconds) * 0.9,
  );
}

/** The cursor as a lens; squared falloff so the pool has no edge. */
function cursorLift(
  x: number,
  y: number,
  layout: Layout,
  cursor: Cursor,
): number {
  if (cursor.strength <= 0.01) return 0;

  const dx = x + layout.cellW / 2 - cursor.x;
  const dy = y + layout.cellH / 2 - cursor.y;
  const near = Math.max(0, 1 - Math.hypot(dx, dy) / layout.reach);

  return near * near * cursor.strength;
}

/** Grid square first, brand square over it: the second one carries the heat. */
function paintCell(
  context: CanvasRenderingContext2D,
  colors: Colors,
  layout: Layout,
  cell: { x: number; y: number; entered: number; heat: number; lift: number },
): void {
  const grow = cell.lift * 1.8;
  const w = layout.cellW + grow;
  const h = layout.cellH + grow;
  const px = cell.x - grow / 2;
  const py = cell.y - grow / 2;

  context.globalAlpha = cell.entered;
  context.fillStyle = colors.grid;
  context.beginPath();
  context.roundRect(px, py, w, h, CELL_RADIUS);
  context.fill();

  context.globalAlpha = cell.entered * (0.06 + cell.heat * 0.72);
  context.fillStyle = colors.brand;
  context.beginPath();
  context.roundRect(px, py, w, h, CELL_RADIUS);
  context.fill();
}

/** One frame of the whole grid. Lives out here so `draw` stays a loop body. */
function paintField(
  context: CanvasRenderingContext2D,
  colors: Colors,
  size: { width: number; height: number },
  tick: Tick,
  cursor: Cursor,
): void {
  const layout = layoutOf(size.width, size.height);
  context.clearRect(0, 0, size.width, size.height);

  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      const entered = cellEntered(row, column, tick);
      if (entered <= 0) continue;

      const x = column * layout.pitchX;
      const y = row * layout.pitchY;
      const lift = cursorLift(x, y, layout, cursor);
      const heat = Math.min(1, cellHeat(row, column, tick) + lift * 0.75);

      paintCell(context, colors, layout, { x, y, entered, heat, lift });
    }
  }

  context.globalAlpha = 1;
}

/** Colours come from tokens, so the art cannot drift from the palette. */
function token(element: Element, name: string, fallback: string): string {
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Twelve weeks of incidents, none of them real.
 *
 * **The field must stay synthetic.** `/login` is unauthenticated, and drawing
 * the instance's own events there would publish when this team deploys and
 * when it breaks to anyone who can load the page.
 *
 * A canvas rather than a grid of elements: 408 divs cost more DOM than the
 * form and could not answer the pointer without a listener each.
 */
export function IncidentField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // A canvas, a rAF loop and two observers: an external system with a
  // lifetime. The pointer stays in a closure, since through state it would
  // re-render sixty times a second.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const colors: Colors = {
      brand: token(canvas, '--color-fg-brand', '#c5f11e'),
      grid: token(canvas, '--color-border-subtle', '#242424'),
    };
    const quiet = window.matchMedia('(prefers-reduced-motion: reduce)');

    // The whole panel, not just the cells: the field should light up as you
    // cross toward the form.
    const surface: Element = canvas.closest('[data-field-surface]') ?? canvas;

    let width = 0;
    let height = 0;
    let frame = 0;
    let started = 0;
    let running = false;
    // Assumed on screen until the observer says otherwise, so the first paint
    // is not deferred a frame on the viewports where the panel is visible.
    let onScreen = true;

    const cursor: Cursor = { x: 0, y: 0, strength: 0, target: 0 };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const box = canvas.getBoundingClientRect();
      width = box.width;
      height = box.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (now: number) => {
      if (!started) started = now;

      const tick: Tick = {
        seconds: (now - started) / 1000,
        intro: Math.min(1, (now - started) / INTRO),
        still: quiet.matches,
      };

      cursor.strength += (cursor.target - cursor.strength) * 0.12;
      paintField(context, colors, { width, height }, tick, cursor);

      // Reduced motion: nothing left to move once the pointer has gone.
      if (tick.still && cursor.strength < 0.01 && cursor.target === 0) {
        running = false;
        return;
      }
      frame = requestAnimationFrame(draw);
    };

    // The single gate: nothing starts the loop for a canvas nobody can see,
    // whichever of the three callers asked.
    const start = () => {
      if (running || !onScreen || document.hidden) return;
      running = true;
      // The cleanup cancels this through `stop`, which the rule cannot see
      // through: it looks for `cancelAnimationFrame` in the effect's own
      // return, and this effect calls the function that calls it.
      // react-doctor-disable-next-line react-doctor/effect-raf-loop-needs-cancel
      frame = requestAnimationFrame(draw);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    const onPointerMove = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      cursor.x = event.clientX - box.left;
      cursor.y = event.clientY - box.top;
      cursor.target = 1;
      start();
    };

    const onPointerLeave = () => {
      cursor.target = 0;
      start();
    };

    const observer = new ResizeObserver(() => {
      resize();
      start();
    });
    observer.observe(canvas);

    const visible = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? false;
      if (onScreen) start();
      else stop();
    });
    visible.observe(canvas);

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    document.addEventListener('visibilitychange', onVisibility);
    surface.addEventListener('pointermove', onPointerMove as EventListener);
    surface.addEventListener('pointerleave', onPointerLeave);

    resize();
    start();

    return () => {
      // `stop()`'s body, inlined: the cancel has to be visible in the cleanup
      // itself, both to a reader and to `effect-raf-loop-needs-cancel`.
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      visible.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      surface.removeEventListener(
        'pointermove',
        onPointerMove as EventListener,
      );
      surface.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  return (
    // `aria-hidden` on the wrapper, not the canvas: a canvas can hold
    // focusable fallback content.
    <div aria-hidden="true">
      <canvas className="h-38 w-full" ref={canvasRef} />
    </div>
  );
}
