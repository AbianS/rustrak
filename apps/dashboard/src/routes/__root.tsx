import { TanStackDevtools } from '@tanstack/react-devtools';
import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';

import '../styles.css';

export const Route = createRootRoute({ component: RootComponent });

/**
 * Nav links use `Link` rather than `<a>` so navigation stays client-side. The
 * point of the spike is that these two moves are different and both work:
 * clicking a link never touches the server, while reloading on `/issues` does,
 * and the server has to answer that with the SPA shell instead of a 404.
 */
const NAV = [
  { to: '/', label: 'Overview' },
  { to: '/issues', label: 'Issues' },
] as const;

function RootComponent() {
  return (
    <div className="min-h-screen bg-canvas text-fg">
      <header className="flex h-13 items-center gap-6 border-b border-border px-5">
        <span className="text-section text-fg">Rustrak</span>

        <nav className="flex items-center gap-1">
          {NAV.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === '/' }}
              className="rounded-md px-2.5 py-1.5 text-control text-fg-muted transition-[color,background-color] duration-instant ease-standard hover:bg-surface-hover hover:text-fg data-[status=active]:bg-surface-selected data-[status=active]:text-fg-brand"
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="p-6">
        <Outlet />
      </main>

      <TanStackDevtools
        config={{ position: 'bottom-right' }}
        plugins={[
          { name: 'TanStack Router', render: <TanStackRouterDevtoolsPanel /> },
        ]}
      />
    </div>
  );
}
