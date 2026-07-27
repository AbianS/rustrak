'use client';

import type { MotionValue } from 'motion/react';
import { createContext } from 'react';

/**
 * The scroll clock a cropped surface runs on, published by whatever is doing
 * the cropping.
 *
 * `MockStage` normally drives a screen's entrance from that screen's own travel
 * through the viewport, which goes wrong the moment the screen is larger than
 * the hole it is seen through: a `Bleed` draws the surface at its full 1240x840
 * behind a 590px window, so the stage finishes its entrance when the *whole*
 * surface reaches centre, several hundred pixels of scroll after the visible
 * rows have gone past. The window knows the right answer because the window is
 * the part that is visible, so it publishes its own progress and the stage
 * prefers it.
 *
 * In its own module rather than in `bleed.tsx` so `stage.tsx` can read it
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
 * The mirror image of the above: a stage decides whether its loops may run by
 * measuring how far past centre its own box has travelled, which is
 * unanswerable for a pinned screen. The hero holds its panel at a fixed offset
 * for a whole 138vh track, so the measurement reads "long gone" from the first
 * frame and every counter and tail inside it stays switched off.
 *
 * `MockStage` takes a `gate` prop for this, but a prop only reaches the stage
 * the hero opens itself — the screens it shows each open their own, four
 * components down, so the signal has to travel as context or not at all.
 */
export const StageGateContext = createContext<MotionValue<number> | null>(null);
