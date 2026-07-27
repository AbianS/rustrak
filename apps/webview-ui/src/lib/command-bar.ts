import { getProjects } from '@/actions/projects';
import {
  DatabaseIcon,
  FolderIcon,
  InfoIcon,
  KeyIcon,
  PaletteIcon,
  PlugIcon,
  PlusIcon,
  SettingsIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react';

export type CommandItem = {
  label: string;
  href: string;
  category: 'Settings' | 'Projects' | 'Project' | ({} & string);
  icon: typeof SettingsIcon;
  /**
   * Project-scoped commands render the project's platform icon instead of
   * `icon`, so the whole group reads as belonging to that project.
   */
  platform?: string | null;
};

export const COMMANDS: CommandItem[] = [
  {
    label: 'Projects',
    href: '/projects',
    category: 'Projects',
    icon: FolderIcon,
  },
  {
    label: 'New project',
    href: '/projects/new',
    category: 'Projects',
    icon: PlusIcon,
  },
  {
    label: 'API tokens',
    href: '/settings/tokens',
    category: 'Settings',
    icon: KeyIcon,
  },
  {
    label: 'Integrations',
    href: '/settings/integrations',
    category: 'Settings',
    icon: PlugIcon,
  },
  {
    label: 'Team',
    href: '/settings/team',
    category: 'Settings',
    icon: UsersIcon,
  },
  {
    label: 'Storage',
    href: '/settings/storage',
    category: 'Settings',
    icon: DatabaseIcon,
  },
  {
    label: 'Account',
    href: '/settings/account',
    category: 'Settings',
    icon: UserIcon,
  },
  {
    label: 'Appearance',
    href: '/settings/appearance',
    category: 'Settings',
    icon: PaletteIcon,
  },
  {
    label: 'About',
    href: '/settings/about',
    category: 'Settings',
    icon: InfoIcon,
  },
];

export async function getProjectCommands(): Promise<CommandItem[]> {
  const projects = await getProjects({ per_page: 100 });
  return projects.items.flatMap((project) => {
    const base = `/projects/${project.id}`;

    const pages: { label: string; segment: string }[] = [
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

    return [
      {
        label: project.name,
        href: base,
        category: project.name,
        icon: FolderIcon,
        platform: project.platform,
      },
      ...pages.map((page) => ({
        label: `${project.name} ${page.label}`,
        href: `${base}${page.segment}`,
        category: project.name,
        icon: FolderIcon,
        platform: project.platform,
      })),
    ];
  });
}
