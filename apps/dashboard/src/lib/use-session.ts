import { useSyncExternalStore } from 'react';
import { auth } from './auth';
import type { AuthStore, Session } from './auth-store';

/**
 * For components that draw the session. Routes must not use it to decide
 * whether to render. That is `_authenticated`'s `beforeLoad`.
 */
export function useSession(store: AuthStore = auth): Session | undefined {
  return useSyncExternalStore(store.subscribe, store.peek, store.peek);
}
