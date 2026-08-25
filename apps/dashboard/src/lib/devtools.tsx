import { lazy, Suspense } from 'react';

/**
 * The devtools panel, in development only.
 *
 * `import.meta.env.DEV` is replaced by the literal `false` in a production
 * build, so the ternary collapses and the dynamic import inside the dead
 * branch is dropped before it ever reaches the bundle. Rendering the panel
 * behind a runtime `if` would not do that: the import would still be static
 * and the whole devtools tree would ship to every self-hosted instance.
 */
const DevtoolsPanel = import.meta.env.DEV
  ? lazy(async () => {
      const [{ TanStackDevtools }, { TanStackRouterDevtoolsPanel }] =
        await Promise.all([
          import('@tanstack/react-devtools'),
          import('@tanstack/react-router-devtools'),
        ]);

      return {
        default: () => (
          <TanStackDevtools
            config={{ position: 'bottom-right' }}
            plugins={[
              {
                name: 'TanStack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        ),
      };
    })
  : null;

export function Devtools() {
  if (!DevtoolsPanel) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <DevtoolsPanel />
    </Suspense>
  );
}
