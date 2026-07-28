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
  category: 'Settings' | 'Projects' | ({} & string);
  /**
   * Rendered only when the command carries no `platform`. Icons are component
   * references and do not cross the server/client boundary, so a command built
   * on the server leaves this unset and leans on `platform` instead.
   */
  icon?: typeof SettingsIcon;
  /**
   * Project-scoped commands render the project's platform icon instead of
   * `icon`, so the whole group reads as belonging to that project.
   */
  platform?: string | null;
};

/**
 * The commands that exist regardless of what the instance contains. Project
 * commands are derived per request; see `features/project/lib/command-items`.
 */
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
