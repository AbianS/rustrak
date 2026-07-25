'use client';

import type { LenisRef } from 'lenis/react';
import { ReactLenis } from 'lenis/react';
import { cancelFrame, frame, time, useReducedMotion } from 'motion/react';
import { type ReactNode, useEffect, useRef } from 'react';
import { FINE_POINTER, useMediaQuery } from './use-media-query';

/**
 * Momentum scrolling for the landing.
 *
 * ── What it costs, measured ─────────────────────────────────────────────────
 *
 * Kept deliberately, with the trade understood rather than assumed.
 *
 * It does not cost framerate. Two production builds differing only in whether
 * this was mounted came out identical on frame pacing: 120Hz held, no frames
 * over 50ms in either.
 *
 * What it costs is a tail. Measured against the same trackpad flick, the page
 * kept moving for **654ms after the last input event** with Lenis, against
 * **2ms** without — and it covered the same distance either way, so the tail is
 * not extra travel, it is the same journey finishing late.
 *
 * And it costs a thread. Lenis does not scroll a transform, it drives the real
 * scroll position by calling `scrollTo` from a frame loop, on the main thread.
 * Native scrolling in Chrome never touches the main thread: it runs on the
 * compositor, so a page keeps scrolling smoothly even while script is blocking.
 * The practical consequence is latent rather than current — there are no long
 * tasks on this page today — but if one ever appears it will read as a hitch in
 * the scroll instead of something the compositor rides over.
 *
 * That is the price of the feel. It was paid on purpose.
 *
 * ── Mice only ───────────────────────────────────────────────────────────────
 *
 * A finger gets nothing from this either, and loses a great deal. The platform
 * already gives touch scrolling its own momentum, and putting a second easing
 * pass over it does not add polish, it fights it: what the visitor feels is a
 * page that lags a beat behind their thumb. It costs more than feel, too —
 * taking the scroll over drops pull-to-refresh, confuses the URL bar's
 * collapse, and moves a phone's most-used gesture onto the main thread.
 *
 * So on a touch device Lenis is not configured differently, it is not mounted.
 * `pointer: fine` rather than a width test: a narrow desktop window is still a
 * mouse. Under reduced motion it is not mounted either — momentum is exactly
 * the sensation that setting asks us to drop.
 *
 * ── One frame loop, not two ─────────────────────────────────────────────────
 *
 * Lenis schedules its own `requestAnimationFrame` by default, independently of
 * Motion's. Two loops means the frame in which Lenis writes the scroll position
 * and the frame in which Motion reads it are not the same frame, and the
 * mismatch shows up as jitter that survives a perfect framerate.
 *
 * `autoRaf: false` plus driving `lenis.raf` from `frame.update` puts both on
 * one clock. `time.now()` rather than `performance.now()` is the part that is
 * easy to get wrong: it is Motion's own synced clock, and passing the raw one
 * reintroduces the drift this is meant to remove.
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
        /*
          Both of these were slower than the library's own defaults, and
          together they were most of why the page felt heavy: 0.075 puts the
          scroll roughly a third of a second behind the wheel before anything
          downstream has even read it, and damping the wheel means covering the
          same distance takes more of them.

          The default lerp and an untouched wheel are the right starting point.
          The glide is still there; it just stops arriving late.
        */
        lerp: 0.1,
        autoRaf: false,
      }}
    >
      {children}
    </ReactLenis>
  );
}
