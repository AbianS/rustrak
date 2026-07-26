'use client';

import type { MotionValue } from 'motion/react';
import { createContext } from 'react';

/**
 * The scroll clock a cropped surface runs on, published by whatever is doing
 * the cropping.
 *
 * ── The bug this exists to fix ──────────────────────────────────────────────
 *
 * `MockStage` drives every entrance inside a screen from that screen's own
 * travel through the viewport: it measures its own box and runs the fill-in
 * from `start end` to `center center`. That is exactly right when the screen is
 * the thing on the page, and quietly wrong the moment the screen is larger than
 * the hole it is being seen through.
 *
 * A `Bleed` draws the surface at its full 1240x840 and then shows a 590px
 * window onto the middle of it. The stage still measures 840 tall, still sits
 * where the untranslated element sits, and still finishes its entrance when
 * *that* box reaches the centre of the viewport. So the rows the reader can
 * actually see were finishing their entrance several hundred pixels of scroll
 * after they had already gone past: the stack trace showed its first three
 * frames and left the rest of the window empty, and it looked like the screen
 * had simply been cropped badly.
 *
 * The window knows the right answer, because the window is the part that is
 * visible. So it publishes its own progress and the stage prefers it.
 *
 * In its own module rather than in `bleed.tsx` so that `stage.tsx` can read it
 * without importing the primitive that writes it, which would put a component
 * in the import graph of everything that animates.
 */
export const WindowProgressContext = createContext<MotionValue<number> | null>(
  null,
);

/**
 * The off-centre signal a screen runs its idle loops against, published by
 * whatever is holding that screen still.
 *
 * The companion to the above, and it exists for the mirror-image reason. A
 * stage decides whether its loops may run by measuring how far past centre its
 * own box has travelled — which is the right question for a screen scrolling
 * down the page and an unanswerable one for a screen that is pinned. The hero
 * holds its panel at a fixed offset for the whole of a 138vh track, so the
 * measurement reads "long gone" from the first frame and every counter, tail
 * and breath inside it stays switched off for the entire time the reader is
 * looking at it.
 *
 * `MockStage` takes a `gate` prop for exactly this, but a prop only reaches the
 * stage the hero opens itself. The screens the hero shows each open their own,
 * four components down, so the signal has to travel as context or not at all.
 */
export const StageGateContext = createContext<MotionValue<number> | null>(null);
