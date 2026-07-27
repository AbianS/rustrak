'use client';

import type { LenisRef } from 'lenis/react';
import { ReactLenis } from 'lenis/react';
import { cancelFrame, frame, time, useReducedMotion } from 'motion/react';
import { type ReactNode, useEffect, useRef } from 'react';
import { FINE_POINTER, useMediaQuery } from './use-media-query';

/**
 * Momentum scrolling for the landing. Kept with the trade measured rather than
 * assumed.
 *
 * It does not cost framerate: two production builds differing only in whether
 * this was mounted held 120Hz identically. What it costs is a tail — against
 * the same trackpad flick the page kept moving for 654ms after the last input
 * event, against 2ms without, over the same distance. And it costs a thread,
 * because Lenis drives the real scroll position from a frame loop on the main
 * thread where native scrolling runs on the compositor. That consequence is
 * latent (there are no long tasks here today), but if one appears it will read
 * as a hitch in the scroll rather than something the compositor rides over.
 *
 * Mice only. The platform already gives touch its own momentum, so a second
 * easing pass over it reads as a page lagging behind the reader's thumb, and
 * taking the scroll over also drops pull-to-refresh and confuses the URL bar's
 * collapse. `pointer: fine` rather than a width test — a narrow desktop window
 * is still a mouse. Not mounted under reduced motion either.
 *
 * One frame loop, not two. Lenis schedules its own `requestAnimationFrame` by
 * default, so the frame in which it writes the scroll position and the frame in
 * which Motion reads it are not the same, and the mismatch is jitter that
 * survives a perfect framerate. `autoRaf: false` plus driving `lenis.raf` from
 * `frame.update` puts both on one clock; `time.now()` rather than
 * `performance.now()` is the easy part to get wrong, since it is Motion's own
 * synced clock and the raw one reintroduces the drift.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const pointing = useMediaQuery(FINE_POINTER);
  const lenis = useRef<LenisRef>(null);
  const enabled = !reduced && pointing;

  useEffect(() => {
    if (!enabled) return;

    const update = () => lenis.current?.lenis?.raf(time.now());
    frame.update(update, true);
    return () => cancelFrame(update);
  }, [enabled]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <ReactLenis
      root
      ref={lenis}
      options={{
        /* The library's own default, restored. At 0.075 the scroll sits
           roughly a third of a second behind the wheel before anything
           downstream has read it, which was most of why the page felt heavy. */
        lerp: 0.1,
        autoRaf: false,
      }}
    >
      {children}
    </ReactLenis>
  );
}
