import { useSyncExternalStore } from 'react';

const MAC_UA = /mac|iphone|ipad|ipod/i;

// The user agent never changes under us, so there is nothing to subscribe to.
const subscribe = () => () => {};

const getSnapshot = () => MAC_UA.test(navigator.userAgent);

/**
 * The server has no idea which OS will receive its HTML, so it commits to the
 * common case and lets the browser correct it. React reads this snapshot
 * during hydration and re-renders before the first paint when it disagrees,
 * which is what an effect could not do: an effect runs after the paint, so a
 * Windows viewer would see ⌘ flash before it became Ctrl.
 */
const getServerSnapshot = () => true;

/** Which modifier this machine spells shortcuts with. */
export function useIsMac() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
