import type { Project } from '@rustrak/client';
import type { CommandItem } from '@/shared/config/commands';

/** The pages every project has, in the order the command bar lists them. */
const PAGES: { label: string; segment: string }[] = [
  { label: 'Issues', segment: '/issues' },
  { label: 'Releases', segment: '/releases' },
  { label: 'Performance', segment: '/performance' },
  { label: 'Agents', segment: '/agents' },
  { label: 'Logs', segment: '/logs' },
  { label: 'General settings', segment: '/settings/general' },
  { label: 'Alerts', segment: '/settings/alerts' },
  { label: 'Members', segment: '/settings/members' },
  { label: 'Client keys', segment: '/settings/client-keys' },
];

/**
 * One command per project page, grouped under the project's own name so the
 * results read as belonging to it.
 *
 * Every item carries `platform` and no `icon`: these are built on the server
 * and handed to a client component, and a component reference would not
 * survive that boundary.
 */
export function toProjectCommands(projects: Project[]): CommandItem[] {
  return projects.flatMap((project) => {
    const base = `/projects/${project.id}`;

    return [
      {
        label: project.name,
        href: base,
        category: project.name,
        platform: project.platform,
      },
      ...PAGES.map((page) => ({
        label: `${project.name} ${page.label}`,
        href: `${base}${page.segment}`,
        category: project.name,
        platform: project.platform,
      })),
    ];
  });
}
