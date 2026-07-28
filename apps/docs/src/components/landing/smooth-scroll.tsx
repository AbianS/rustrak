'use client';

import type { LenisRef } from 'lenis/react';
import { ReactLenis } from 'lenis/react';
import {
  cancelFrame,
  domAnimation,
  frame,
  LazyMotion,
  time,
  useReducedMotion,
} from 'motion/react';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { FINE_POINTER, useMediaQuery } from './use-media-query';

const SmoothScrollContext = createContext(false);

/**
 * Whether Lenis is currently driving the scroll.
 *
 * Not the same question as "is Lenis mounted", and the difference is the whole
 * reason this exists. Lenis is mounted on every device now (see below), so
 * `useLenis()` hands back an instance on a phone as readily as on a desktop —
 * and an instance whose frame loop is not running will accept a `scrollTo`,
 * set a target, and never move. Anything that wants to hand the scroll to
 * Lenis has to ask this first and keep its native fallback for when the answer
 * is no. `sections/platform.tsx` is the one caller.
 */
export function useSmoothScrolling(): boolean {
  return useContext(SmoothScrollContext);
}

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
 * is still a mouse. Off under reduced motion too.
 *
 * One frame loop, not two. Lenis schedules its own `requestAnimationFrame` by
 * default, so the frame in which it writes the scroll position and the frame in
 * which Motion reads it are not the same, and the mismatch is jitter that
 * survives a perfect framerate. `autoRaf: false` plus driving `lenis.raf` from
 * `frame.update` puts both on one clock; `time.now()` rather than
 * `performance.now()` is the easy part to get wrong, since it is Motion's own
 * synced clock and the raw one reintroduces the drift.
 *
 * ── Off is a switch, not an absence ─────────────────────────────────────────
 *
 * `ReactLenis` is mounted unconditionally and `smoothWheel` is what turns the
 * behaviour on and off. It used to return a bare fragment when disabled, which
 * is a different element type in the same position — so the first client render
 * (where `useMediaQuery` has not answered yet and reads `false`) built the
 * whole landing, and the render after it threw all of that away and built it
 * again under `ReactLenis`. One wasted mount of the largest tree on the site,
 * on every desktop visit, in the second the page is least able to afford it.
 *
 * `smoothWheel: false` is a real off and not a pretence: Lenis checks it before
 * it calls `preventDefault` on a wheel event, so with it false the browser
 * scrolls the page itself exactly as it would with nothing mounted. Touch was
 * never taken over in the first place — `syncTouch` is off by default. And the
 * frame loop below stays gated on `enabled`, so a phone is not running a
 * per-frame callback for a library that is standing aside.
 *
 * What it does change is that `useLenis()` now returns an instance everywhere.
 * That is what `useSmoothScrolling` above is for.
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

  return (
    <SmoothScrollContext.Provider value={enabled}>
      <ReactLenis
        root
        ref={lenis}
        options={{
          /* The library's own default, restored. At 0.075 the scroll sits
             roughly a third of a second behind the wheel before anything
             downstream has read it, which was most of why the page felt
             heavy. */
          lerp: 0.1,
          autoRaf: false,
          smoothWheel: enabled,
        }}
      >
        {/*
          Every animated element below is `m.*` from `motion/react-m`, which
          ships no features of its own: they arrive here instead. The full
          `motion` component carries all of them at ~34kb, against ~4.6kb plus
          the 15kb of `domAnimation` for the same landing.

          `domAnimation` and not `domMax` because the difference is pan/drag
          gestures and layout animations, and this page uses none: no `layout`,
          no `layoutId`, no `drag`, no `Reorder`. Adding any of those means
          moving to `domMax` in the same commit, because with `domAnimation`
          they do not warn, they simply never animate.

          `strict` makes that enforceable rather than a convention: rendering a
          plain `motion.*` anywhere under here throws instead of quietly
          pulling the full bundle back in and undoing all of this.
        */}
        <LazyMotion features={domAnimation} strict>
          {children}
        </LazyMotion>
      </ReactLenis>
    </SmoothScrollContext.Provider>
  );
}
