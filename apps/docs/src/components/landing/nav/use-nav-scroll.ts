'use client';

import { useMotionValueEvent, useScroll } from 'motion/react';
import { useRef, useState } from 'react';

/**
 * Scroll past which the bar is allowed to tuck away at all.
 *
 * The hero owns the top of the page and the bar belongs to it, so nothing is
 * hidden until the reader has left it behind.
 */
const NAV_ALWAYS_ABOVE = 140;

/**
 * Travel in one direction, in pixels, before the bar changes its mind.
 *
 * Asymmetric on purpose: hiding should take a deliberate scroll down, and
 * bringing it back should feel immediate.
 */
const NAV_HIDE_AFTER = 72;
const NAV_SHOW_AFTER = 48;

/**
 * How the bar responds to the page moving underneath it.
 *
 * `lifted` is "no longer at the very top", which is what earns the bar its
 * background. `tucked` is "get out of the way", and the two are separate
 * because a bar can be lifted for the whole page and tucked for none of it.
 *
 * Neither is adjusted from anywhere else. The bar is what the menu is closed
 * back onto, so opening the menu has to bring it back — but that is an event,
 * not a prop change, so the menu calls  rather than this watching it.
 */
export function useNavScroll() {
  const { scrollY } = useScroll();
  const [lifted, setLifted] = useState(false);
  const [tucked, setTucked] = useState(false);

  const at = useRef(0);
  const run = useRef(0);

  // Reading the motion value beats a scroll listener plus state: the value is
  // already being tracked for the scrubs, and this only re-renders on the
  // single frame a threshold is crossed.
  useMotionValueEvent(scrollY, 'change', (value) => {
    setLifted(value > 24);

    const delta = value - at.current;
    at.current = value;
    if (delta === 0) return;

    if (value <= NAV_ALWAYS_ABOVE) {
      run.current = 0;
      setTucked(false);
      return;
    }

    // A change of direction starts the count again, which is what makes the
    // thresholds mean "travelled this far up" rather than "ended up this far
    // from wherever the last event happened to be".
    if (delta > 0 !== run.current > 0) run.current = 0;
    run.current += delta;

    if (run.current > NAV_HIDE_AFTER) setTucked(true);
    else if (run.current < -NAV_SHOW_AFTER) setTucked(false);
  });

  /**
   * Brings the bar back without a scroll.
   *
   * A tucked bar is off screen but its links are still in the tab order, and
   * focusing something above the viewport is a dead end. Cheaper and kinder
   * than `inert`: reaching for it brings it back.
   */
  const untuck = () => setTucked(false);

  return { lifted, tucked, untuck };
}
