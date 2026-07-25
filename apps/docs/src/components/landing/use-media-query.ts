'use client';

import { useEffect, useState } from 'react';

/**
 * A media query, as a boolean.
 *
 * Reserved for the handful of places where a breakpoint has to be known to
 * *JavaScript* rather than to CSS — a scroll transform that should not run at
 * all on a phone, a library that should not be mounted on a touch device.
 * Anything that can be said in a `lg:` variant is said there instead: this hook
 * costs a re-render and a frame of the wrong answer, and CSS costs neither.
 *
 * It always starts `false`, so the server and the first client render agree.
 * Every caller therefore has to read `false` as "the plain, unenhanced case",
 * which is the right default anyway: the enhancement is what arrives late.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** The `lg` breakpoint, where the hero's satellites and the rail appear. */
export const DESKTOP = '(min-width: 1024px)';

/**
 * A device that points rather than touches. Not a width test: a narrow desktop
 * window is still a mouse, and a wide tablet is still a finger.
 */
export const FINE_POINTER = '(pointer: fine)';
