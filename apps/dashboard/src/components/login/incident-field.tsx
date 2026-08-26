import { useEffect, useRef } from 'react';

const ROWS = 12;
const COLUMNS = 34;
const CELL_GAP = 3;
const CELL_RADIUS = 1.5;
/** How long the field takes to draw itself in, in milliseconds. */
const INTRO = 900;
/** How far the cursor reaches, as a multiple of the cell pitch. */
const CURSOR_REACH = 5.5;

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

    const brand = token(canvas, '--color-fg-brand', '#c5f11e');
    const grid = token(canvas, '--color-border-subtle', '#242424');
    const quiet = window.matchMedia('(prefers-reduced-motion: reduce)');

    // The whole panel, not just the cells: the field should light up as you
    // cross toward the form.
    const surface: Element = canvas.closest('[data-field-surface]') ?? canvas;

    let width = 0;
    let height = 0;
    let frame = 0;
    let started = 0;
    let running = false;

    /** Where the pointer is, in CSS pixels from the canvas corner. */
    const cursor = { x: 0, y: 0, strength: 0, target: 0 };

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
      const seconds = (now - started) / 1000;
      const intro = Math.min(1, (now - started) / INTRO);
      const still = quiet.matches;

      cursor.strength += (cursor.target - cursor.strength) * 0.12;

      const pitchX = (width + CELL_GAP) / COLUMNS;
      const pitchY = (height + CELL_GAP) / ROWS;
      const cellW = pitchX - CELL_GAP;
      const cellH = pitchY - CELL_GAP;
      const reach = CURSOR_REACH * pitchX;

      context.clearRect(0, 0, width, height);

      for (let row = 0; row < ROWS; row++) {
        for (let column = 0; column < COLUMNS; column++) {
          // Diagonal sweep: drawn the way it is read, oldest week first.
          const arrival = (column / COLUMNS) * 0.7 + (row / ROWS) * 0.3;
          const entered = still
            ? 1
            : Math.min(1, Math.max(0, (intro - arrival * 0.6) * 3));
          if (entered <= 0) continue;

          const x = column * pitchX;
          const y = row * pitchY;
          const base = restingHeat(row, column);

          // Slow enough that you never catch it moving. Faster reads as a
          // loading state.
          const wave = still
            ? 1
            : 0.55 + 0.45 * Math.sin(seconds * 0.7 - column * 0.19 - row * 0.1);

          let heat = base * wave;
          if (!still) {
            heat = Math.min(1, heat + base * spike(row, column, seconds) * 0.9);
          }

          // The cursor as a lens; squared falloff so the pool has no edge.
          let lift = 0;
          if (cursor.strength > 0.01) {
            const dx = x + cellW / 2 - cursor.x;
            const dy = y + cellH / 2 - cursor.y;
            const near = Math.max(0, 1 - Math.hypot(dx, dy) / reach);
            lift = near * near * cursor.strength;
            heat = Math.min(1, heat + lift * 0.75);
          }

          const grow = lift * 1.8;
          const w = cellW + grow;
          const h = cellH + grow;
          const px = x - grow / 2;
          const py = y - grow / 2;

          context.globalAlpha = entered;
          context.fillStyle = grid;
          context.beginPath();
          context.roundRect(px, py, w, h, CELL_RADIUS);
          context.fill();

          context.globalAlpha = entered * (0.06 + heat * 0.72);
          context.fillStyle = brand;
          context.beginPath();
          context.roundRect(px, py, w, h, CELL_RADIUS);
          context.fill();
        }
      }

      context.globalAlpha = 1;

      // Reduced motion: nothing left to move once the pointer has gone.
      if (still && cursor.strength < 0.01 && cursor.target === 0) {
        running = false;
        return;
      }
      frame = requestAnimationFrame(draw);
    };

    const start = () => {
      if (running) return;
      running = true;
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
      if (entry?.isIntersecting && !document.hidden) start();
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
      stop();
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
