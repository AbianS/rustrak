'use client';

import {
  createContext,
  type RefObject,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';

/**
 * The viewport the recreated app is authored against.
 *
 * Tall enough that the overview's bento reaches its third row: the app's own
 * measurements are used throughout (a 64px header, a 256px rail, `text-3xl`
 * stat tiles), so the frame has to be a plausible browser window rather than a
 * convenient rectangle — shrink it and the only way to fit the screens is to
 * start shaving the product down, which is exactly the dishonesty this
 * recreation exists to avoid.
 */
export const DESIGN_WIDTH = 1240;
export const DESIGN_HEIGHT = 840;

/**
 * The narrow design, for phones.
 *
 * Scaling one design to fit is fine until the container is a phone, and then it
 * stops being a trade-off and becomes a failure: at 340px the 1240px design
 * lands at 0.27, which renders the app's 14px label at *3.8px*. So below
 * `COMPACT_QUERY` the screens render a genuinely narrower layout instead of a
 * smaller picture of the wide one — the rail comes out, gutters tighten, tables
 * drop columns, the bento halves its column count. 600px is the width that
 * falls out of that, and it puts a 390px phone at ~0.6, which is the size the
 * desktop page shows the same label at anyway.
 */
export const COMPACT_WIDTH = 600;
export const COMPACT_HEIGHT = 900;

/**
 * Which design a frame draws. Tailwind's `sm`, exactly — and that it is the
 * *viewport* rather than the container is the point.
 *
 * Keying off each frame's own width was the obvious reading and it was wrong.
 * The hero's panel and the panels in the platform chapters sit in cells of
 * different widths, so on a tablet one crossed the threshold and the other did
 * not: the same product drawn two different ways, a scroll apart. Which layout
 * the app is in is a fact about the device, not about the box it sits in.
 */
export const COMPACT_QUERY = '(max-width: 639px)';

/**
 * Whether the surrounding frame is drawing its narrow layout.
 *
 * Published as context rather than passed down: the screens are four levels
 * deep in places, and this is a property of the *frame*, not of any one screen.
 * The fallback is `false`, so a fragment rendered outside a frame (the two-up
 * minis, the hanging cards) keeps its wide layout.
 */
export const CompactContext = createContext(false);

export function useCompact(): boolean {
  return useContext(CompactContext);
}

/** Measuring has to land before paint, or the frame flashes at scale 1. */
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Measures an element against the design it is drawing, and tracks which design
 * that is.
 *
 * Shared by the two surfaces that show recreated product UI, which want the
 * same measurement and differ only in what they do with the wide case:
 * `AppFrame` scales the whole application down to fit its cell, and `Bleed`
 * draws at 1:1 and crops. Passing `null` for `wideWidth` selects the second.
 *
 * Reads `matchMedia` directly rather than through `useMediaQuery`: that hook
 * answers after paint, which on a phone would mean one frame of the wide design
 * at 0.27 before it flipped.
 */
export function useDesignScale(
  ref: RefObject<HTMLElement | null>,
  wideWidth: number | null,
): { scale: number; compact: boolean } {
  const [box, setBox] = useState({ scale: 1, compact: false });

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const phone = window.matchMedia(COMPACT_QUERY);

    const measure = () => {
      const compact = phone.matches;
      setBox((current) => {
        const against = compact ? COMPACT_WIDTH : wideWidth;
        const scale = against ? element.clientWidth / against : 1;
        // Guarded so a ResizeObserver firing on a sub-pixel reflow does not
        // re-render the whole recreated app for nothing.
        return current.compact === compact &&
          Math.abs(current.scale - scale) < 0.0005
          ? current
          : { scale, compact };
      });
    };
    measure();

    // The observer covers almost every case on its own — crossing the
    // breakpoint resizes the container too. The query is listened to as well
    // for the one it does not: a full-bleed frame whose width happens not to
    // change across the boundary.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    phone.addEventListener('change', measure);
    return () => {
      observer.disconnect();
      phone.removeEventListener('change', measure);
    };
  }, [ref, wideWidth]);

  return box;
}
