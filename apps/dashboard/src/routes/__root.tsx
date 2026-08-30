import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { Devtools } from '../lib/devtools';
import type { RouterContext } from '../router';
import '../styles.css';

// Draws nothing: the root renders on every URL including `/login`, so the
// application frame lives in `_authenticated` instead.
export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <Outlet />
      <Devtools />
    </>
  );
}
