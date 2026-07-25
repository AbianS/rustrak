'use client';

import { type RefObject, useEffect, useState } from 'react';

/**
 * Whether an element is currently in the viewport.
 *
 * The page already had four hand-rolled observers doing versions of this, and
 * this is the one that pays for itself twice over: it is not only a trigger for
 * things that enter, it is the off switch for things that loop. A pulse, a
 * caret, a typing clock — none of them are free, and all of them were running
 * whether or not anyone was in a position to see them.
 *
 * `once` is the trigger case: latch on first sight and stop observing, for an
 * entrance that should not replay. Leave it off for the gate case, where the
 * value has to keep tracking so a loop can be shut down again on the way out.
 *
 * Always starts `false`, so the server and the first client render agree. That
 * makes `false` mean "the plain, unenhanced case" for every caller, which is
 * the right default: the enhancement is what arrives late.
 */
export function useOnScreen(
  ref: RefObject<Element | null>,
  {
    once = false,
    rootMargin = '0px',
    threshold = 0,
  }: { once?: boolean; rootMargin?: string; threshold?: number } = {},
): boolean {
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const showing = entries[0]?.isIntersecting ?? false;
        if (once) {
          if (!showing) return;
          setOnScreen(true);
          observer.disconnect();
          return;
        }
        setOnScreen(showing);
      },
      { rootMargin, threshold },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, once, rootMargin, threshold]);

  return onScreen;
}
