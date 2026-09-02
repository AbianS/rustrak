import { DialogProvider, ToastProvider } from '@rustrak/ui';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { Devtools } from '../lib/devtools';
import type { RouterContext } from '../router';
import '../styles.css';

// Draws nothing of its own: the root renders on every URL including `/login`,
// so the application frame lives in `_authenticated` instead.
//
// The two providers do go here. Both mount at the application root by design
// (where a notice appears and where a modal is portalled are the design
// system's decisions, not each screen's), and `/login` reaches for them too.
export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ToastProvider>
      <DialogProvider>
        <Outlet />
        <Devtools />
      </DialogProvider>
    </ToastProvider>
  );
}
