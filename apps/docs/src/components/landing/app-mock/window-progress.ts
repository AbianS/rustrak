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
