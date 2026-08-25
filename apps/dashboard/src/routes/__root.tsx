import {
  AppShell,
  EnvironmentIcon,
  OverviewIcon,
  Sidebar,
  SidebarCollapseButton,
  SidebarItem,
  Topbar,
  TopbarBrand,
  TopbarMenuButton,
} from '@rustrak/ui';
import {
  createRootRoute,
  Link,
  Outlet,
  useRouterState,
} from '@tanstack/react-router';
import { Devtools } from '../lib/devtools';
import '../styles.css';

export const Route = createRootRoute({
  component: RootComponent,
});

/**
 * The frame every route renders inside.
 *
 * `AppShell` brings the tooltip provider with it, so nothing else has to be
 * wrapped here. The links go through `render={<Link />}`: the design system
 * draws the row and the router owns the navigation, which is what keeps the
 * package free of a routing dependency.
 */
function RootComponent() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <>
      <AppShell
        topbar={
          <Topbar
            brand={<TopbarBrand render={<Link to="/" />} />}
            menu={<TopbarMenuButton />}
          />
        }
        sidebar={
          <Sidebar footer={<SidebarCollapseButton />}>
            <SidebarItem
              icon={OverviewIcon}
              label="Overview"
              active={pathname === '/'}
              render={<Link to="/" />}
            />
            <SidebarItem
              icon={EnvironmentIcon}
              label="Projects"
              active={pathname.startsWith('/projects')}
              render={<Link to="/projects" />}
            />
          </Sidebar>
        }
      >
        <Outlet />
      </AppShell>
      <Devtools />
    </>
  );
}
