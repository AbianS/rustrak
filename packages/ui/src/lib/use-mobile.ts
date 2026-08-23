'use client';

import { useEffect, useState } from 'react';

/** Below `md`, which is where the sidebar stops fitting alongside content. */
const MOBILE_QUERY = '(max-width: 47.9375rem)';

export interface MobileBreakpoint {
  /** Whether this is being looked at from a phone. */
  mobile: boolean;
  /**
   * True for the frame in which the breakpoint is crossed.
   *
   * It exists to switch transitions off at exactly that instant. Crossing it,
   * the sidebar goes from occupying a column to being a drawer parked off
   * screen, and the browser cannot tell that resize from one somebody asked
   * for: it animates it, and the sidebar sweeps across the screen while the
   * window corner is being dragged.
   *
   * Animate what is requested, not what falls out of a resize.
   */
  switching: boolean;
}

/**
 * The mobile breakpoint, and whether it was just crossed.
 *
 * It starts at `false` in the browser too, so the first paint matches the
 * server's and React has nothing to reconcile.
 */
export function useMobileBreakpoint(): MobileBreakpoint {
  const [mobile, setMobile] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);

    const sync = () => {
      setSwitching(true);
      setMobile(query.matches);
    };

    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!switching) {
      return;
    }

    /*
     * Two frames: on the first the browser applies the new measurements, on
     * the second transitions come back on. With only one, the transition is
     * re-enabled before the change has reached the screen and the jump is
     * visible again.
     */
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setSwitching(false));
    });

    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [switching]);

  return { mobile, switching };
}
