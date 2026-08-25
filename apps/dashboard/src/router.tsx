import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

/**
 * The router.
 *
 * `basepath` is left at the root deliberately. The server mounts the bundle at
 * `/` and keeps `/api`, `/auth` and `/health` for itself; moving the dashboard
 * under a sub-path means changing three things at once -- `base` in
 * `vite.config.ts`, `basepath` here, and the mount in `routes::dashboard` --
 * and any two of the three agreeing is a white page.
 */
export function getRouter() {
  return createTanStackRouter({
    routeTree,
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
