'use client';

import { useSyncExternalStore } from 'react';

// Hydration happens once and never reverses, so there is nothing to subscribe
// to. The signal is entirely in the two snapshots disagreeing.
const subscribe = () => () => {};

const getSnapshot = () => true;

const getServerSnapshot = () => false;

/**
 * False on the server, true from the first client render.
 *
 * The one clock everything on the landing that enters is sequenced from. Two
 * snapshots rather than a bare `true` because that is what makes the server
 * render the resting state — the copy is in the HTML for a reader without
 * JavaScript, and the animations begin when there is a client alive to run
 * them rather than being half over by the time the page is interactive.
 *
 * Every consumer is a motion component with an explicit `initial`, so it mounts
 * at the resting values and drives the entrance itself. Reading this during the
 * hydration render rather than from a mount effect therefore costs no frame of
 * the animation, and saves the one where the server's guess is on screen.
 */
export function useStarted(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
