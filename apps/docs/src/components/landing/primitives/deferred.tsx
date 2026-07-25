'use client';

import { type ReactNode, useRef } from 'react';
import { useOnScreen } from '../use-on-screen';

/**
 * Renders nothing until its box comes within reach of the viewport, then
 * renders its children and never unmounts them again.
 *
 * ── Why this is not `content-visibility` ────────────────────────────────────
 *
 * The showcase cells carried `content-visibility: auto` for a while, on the
 * reasonable theory that it covered this. It does not, and the two turned out
 * to be mutually exclusive besides — see the note left in `globals.css`.
 *
 * `content-visibility` lets the browser skip *layout and paint* for a subtree
 * it cannot see. It does not skip downloading the JavaScript that describes the
 * subtree, parsing it, hydrating it, or serialising it into the HTML. Those are
 * the load costs, and they were being paid in full for every recreated screen
 * on the page whether or not anyone scrolled far enough to meet it. Paired with
 * `next/dynamic` this is what actually removes them: the chunk is never even
 * requested until the chapter is approaching.
 *
 * ── Mounted once, never unmounted ───────────────────────────────────────────
 *
 * `once` is deliberate, and it is a trade rather than an oversight. Unmounting
 * on the way out would reclaim the memory, but every screen on this page is a
 * scroll-scrubbed state machine: its entrance runs backwards when you scroll
 * back up, and that only works if the machine is still there. Tearing it down
 * and rebuilding it would replay the entrance from nothing on the way back,
 * which is exactly the "it fires the moment the element clips the viewport"
 * failure the scrub exists to avoid.
 *
 * ── Reserving the space ─────────────────────────────────────────────────────
 *
 * Nothing here reserves height, and it must not. This is meant to be placed
 * *inside* something that is already sized — `AppFrame` fixes its own
 * `aspectRatio`, so the frame holds the box open and only its contents wait.
 * The visitor sees an empty screen fill in rather than the page jumping.
 */
export function Deferred({
  children,
  className,
  /**
   * How far ahead to start. Generous on purpose: the chunk still has to be
   * fetched, parsed and hydrated, and a margin that only just clears the fold
   * would mean watching that happen.
   */
  rootMargin = '1200px',
}: {
  children: ReactNode;
  className?: string;
  rootMargin?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const near = useOnScreen(box, { once: true, rootMargin });

  return (
    <div ref={box} className={className}>
      {near ? children : null}
    </div>
  );
}
