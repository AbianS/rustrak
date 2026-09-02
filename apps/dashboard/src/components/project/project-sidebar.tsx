import type { Project } from '@rustrak/client';
import type { MessageKey, Translator } from '@rustrak/i18n';
import {
  AgentsIcon,
  type IconComponent,
  IssuesIcon,
  LogsIcon,
  OverviewIcon,
  PerformanceIcon,
  ReleasesIcon,
  SettingsIcon,
  Sidebar,
  SidebarCollapseButton,
  SidebarItem,
} from '@rustrak/ui';
import { Link, useRouterState } from '@tanstack/react-router';
import { ProjectSwitcher } from './project-switcher';

/**
 * The seven routes inside a project, in the order they are worked through:
 * what happened, what is broken, what shipped, how fast it is, what the agents
 * did, what was logged, and how it is configured.
 *
 * `to` is a route path rather than a built string, so a typo is a type error
 * and a route that is renamed takes this list with it.
 */
const ROUTES = [
  {
    to: '/projects/$id',
    label: 'projectOverview.navOverview',
    icon: OverviewIcon,
    exact: true,
  },
  {
    to: '/projects/$id/issues',
    label: 'projectOverview.navIssues',
    icon: IssuesIcon,
  },
  {
    to: '/projects/$id/releases',
    label: 'projectOverview.navReleases',
    icon: ReleasesIcon,
  },
  {
    to: '/projects/$id/performance',
    label: 'projectOverview.navPerformance',
    icon: PerformanceIcon,
  },
  {
    to: '/projects/$id/agents',
    label: 'projectOverview.navAgents',
    icon: AgentsIcon,
  },
  {
    to: '/projects/$id/logs',
    label: 'projectOverview.navLogs',
    icon: LogsIcon,
  },
  {
    to: '/projects/$id/settings',
    label: 'projectOverview.navSettings',
    icon: SettingsIcon,
  },
] as const satisfies readonly {
  to: string;
  label: MessageKey;
  icon: IconComponent;
  exact?: boolean;
}[];

interface ProjectSidebarProps {
  current: Project;
  projects: readonly Project[];
  t: Translator;
}

export function ProjectSidebar({ current, projects, t }: ProjectSidebarProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const root = `/projects/${current.id}`;

  return (
    <Sidebar
      footer={<SidebarCollapseButton />}
      header={<ProjectSwitcher current={current} projects={projects} t={t} />}
    >
      {ROUTES.map((route) => {
        const href = route.to.replace('$id', String(current.id));

        return (
          <SidebarItem
            key={route.to}
            // Overview is the project root, so it matches everything under it
            // unless it asks for the exact path. The other six own a prefix.
            active={
              'exact' in route ? pathname === root : pathname.startsWith(href)
            }
            icon={route.icon}
            label={t.t(route.label)}
            render={<Link params={{ id: String(current.id) }} to={route.to} />}
          />
        );
      })}
    </Sidebar>
  );
}
