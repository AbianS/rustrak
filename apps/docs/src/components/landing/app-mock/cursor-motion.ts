/**
 * The pointer's motion model: how long a hop takes and how long a press lasts.
 *
 * Split out of `cursor.tsx` because `tour.tsx` schedules against these numbers
 * and a module that exports both a component and a helper cannot keep its
 * state across a Fast Refresh. The drawing stays in `cursor.tsx`; only the
 * timing lives here.
 */

export interface Point {
  x: number;
  y: number;
}

/** How long the button is held down. */
export const PRESS = 0.14;

/** Slowest and fastest an ordinary hop may be, and the distance between them. */
const NEAR = 0.85;
const FAR = 1.45;
const SPAN = 900;

/** Time to cross from one target to another. */
export function travelTime(from: Point, to: Point): number {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return NEAR + Math.min(distance / SPAN, 1) * (FAR - NEAR);
}
