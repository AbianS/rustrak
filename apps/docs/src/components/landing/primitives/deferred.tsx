'use client';

import { type ReactNode, useRef } from 'react';
import { useOnScreen } from '../use-on-screen';

/**
 * Renders nothing until its box comes within reach of the viewport, then
 * renders its children and never unmounts them again.
 *
 * Not `content-visibility`, which skips layout and paint for a subtree but not
 * downloading, parsing, hydrating or serialising it. Those are the load costs,
 * and they were being paid for every recreated screen on the page whether or
 * not anyone scrolled to it. Paired with `next/dynamic` this removes them: the
 * chunk is never requested until the chapter is approaching.
 *
 * Mounted once and never unmounted, which is a trade rather than an oversight.
 * Every screen here is a scroll-scrubbed state machine whose entrance runs
 * backwards on the way up, and that only works if the machine is still there.
 *
 * Reserves no height, and must not: it belongs *inside* something already sized
 * (`AppFrame` fixes its own `aspectRatio`), so the frame holds the box open and
 * only its contents wait. The visitor sees an empty screen fill in rather than
 * the page jumping.
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
