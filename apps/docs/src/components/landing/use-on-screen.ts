'use client';

import { type RefObject, useEffect, useState } from 'react';

/**
 * Whether an element is currently in the viewport.
 *
 * Not only a trigger for things that enter but the off switch for things that
 * loop: a pulse, a caret, a typing clock are none of them free, and all of them
 * would otherwise run whether or not anyone can see them.
 *
 * `once` is the trigger case — latch on first sight and stop observing, for an
 * entrance that should not replay. Leave it off for the gate case, where the
 * value has to keep tracking so a loop can be shut down on the way out.
 *
 * Always starts `false`, so the server and the first client render agree, and
 * every caller reads `false` as "the plain, unenhanced case".
 */
export function useOnScreen(
  ref: RefObject<Element | null>,
  {
    once = false,
    rootMargin = '0px',
    threshold = 0,
    /** Skips observing entirely, for a caller whose answer comes from elsewhere. */
    enabled = true,
  }: {
    once?: boolean;
    rootMargin?: string;
    threshold?: number;
    enabled?: boolean;
  } = {},
): boolean {
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
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
  }, [ref, once, rootMargin, threshold, enabled]);

  return onScreen;
}

/**
 * Whether a block should be showing its revealed state.
 *
 * The two headline primitives both offer the same choice: reveal when scrolled
 * into view, or hand the decision to a parent with `active` (the hero does
 * this, to wait for the page to start). Passing `active` skips the observer
 * rather than running one whose answer is thrown away.
 */
export function useRevealed(
  ref: RefObject<Element | null>,
  active: boolean | undefined,
  options: { rootMargin?: string; threshold?: number } = {},
): boolean {
  const seen = useOnScreen(ref, {
    ...options,
    once: true,
    enabled: active === undefined,
  });
  return active ?? seen;
}
