'use client';

import { useReducedMotion } from 'motion/react';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/**
 * Traffic arriving, while the reader is looking.
 *
 * ── Why the hero needed a clock at all ──────────────────────────────────────
 *
 * Every other screen on this page is a pure function of scroll position, and
 * that is the right model for them: the reader drives, the screen answers. The
 * hero cannot use it. Its panel is pinned, so there is no travel to read, and
 * it is the first thing on the page, so most of the time nobody is scrolling.
 *
 * The overview is also the one screen in the product whose nature is to hold
 * still. It is an aggregate: a total, a mean line, a bento of summaries. Left
 * to itself it is a photograph, and a photograph is what the hero used to be —
 * a counter crawling by three a second and a bar breathing, which is a page
 * that is switched on rather than a product that is doing something.
 *
 * So a batch of events lands every few seconds, and three marks answer it: the
 * project's lifetime count steps, the period's event tile steps with it, and
 * the current hour's bucket grows by a notch it does not give back. Every other
 * batch also carries a fingerprint nobody has seen before, and the new-issue
 * tile takes it and rings.
 *
 * ── Honesty ─────────────────────────────────────────────────────────────────
 *
 * The size of a batch is not a number picked for looking good. The project's
 * background trickle is 3.2 events a second and the beat is every eight, so
 * forty-odd is what those two figures already imply; a counter that crawls at
 * three a second and then jumps by four hundred is describing two different
 * services. Most batches create no issue at all, because grouping identical
 * crashes onto one issue is the thing the server is for — a dashboard where
 * every arrival minted a new row would be advertising the opposite.
 *
 * ── Gating ──────────────────────────────────────────────────────────────────
 *
 * `active` is the hero's own on-screen signal, so nothing beats for a reader
 * who is three sections down, and nothing beats at all under
 * `prefers-reduced-motion` — the dashboard is perfectly legible in its resting
 * state, which is the state it then holds.
 */

interface Scene {
  /**
   * Batches landed so far. Monotonic, never reset.
   *
   * Every surface that reacts derives its state from the count rather than
   * incrementing its own, so a beat that fires while the panel is showing one
   * of the other screens is caught up on rather than lost — which is why the
   * overview does not come back to the tour exactly where it was left.
   */
  tick: number;
}

const SceneContext = createContext<Scene>({ tick: 0 });

/** The arrival count. Safe outside a scene: zero, and nothing moves. */
export function useScene(): Scene {
  return useContext(SceneContext);
}

/**
 * Milliseconds between batches.
 *
 * Long enough that the step is an event rather than a churn: the pause is what
 * lets a reader notice that the number is different from the number they were
 * looking at a moment ago, and a figure that never settles cannot be read at
 * all.
 */
const BEAT = 8000;

export function EventScene({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const running = active && !reduced;

  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((n) => n + 1), BEAT);
    return () => clearInterval(id);
  }, [running]);

  const value = useMemo(() => ({ tick }), [tick]);

  return (
    <SceneContext.Provider value={value}>{children}</SceneContext.Provider>
  );
}
