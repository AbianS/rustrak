import { useSyncExternalStore } from 'react';

// Hydration happens once and never reverses, so there is nothing to subscribe to.
// The signal is entirely in the two snapshots disagreeing.
const subscribe = () => () => {};

const getSnapshot = () => true;

/**
 * The server cannot know anything that only exists in the browser, so it
 * commits to `false` and lets React correct it. React reads the client
 * snapshot during hydration and re-renders before the first paint, which is
 * what a mount effect could not do: an effect runs after the paint, so the
 * server's guess is painted first and the correction reads as a flash.
 */
const getServerSnapshot = () => false;

/** False while rendering on the server, true once the client has taken over. */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
