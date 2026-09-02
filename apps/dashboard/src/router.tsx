import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { type AuthStore, auth } from './lib/auth';
import { routeTree } from './routeTree.gen';

/** What every route's `beforeLoad` and `loader` can reach. */
export interface RouterContext {
  auth: AuthStore;
}

/**
 * `basepath` stays at the root: the server mounts the bundle at `/`, and
 * moving it means changing `vite.config.ts`, this, and `routes::dashboard`
 * together. `auth` goes in at construction: it is a module singleton, so
 * there is no React state to re-inject through `RouterProvider`.
 */
export function getRouter() {
  return createTanStackRouter({
    routeTree,
    context: { auth },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
