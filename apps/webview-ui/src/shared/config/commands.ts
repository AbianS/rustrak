import {
  BellIcon,
  BotIcon,
  BugIcon,
  DatabaseIcon,
  FolderIcon,
  GaugeIcon,
  InfoIcon,
  KeyIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  PaletteIcon,
  PlugIcon,
  PlusIcon,
  RocketIcon,
  ScrollTextIcon,
  SettingsIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react';

/**
 * A row in the command bar.
 *
 * `description` is the line under the label and the body of the detail panel,
 * so it is written to be read, not to be matched. `keywords` is the opposite:
 * never rendered, it only widens what the matcher accepts, so "logout" reaches
 * Account and "apm" reaches Performance without those words on screen.
 */
export type CommandLink = {
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
  keywords?: string[];
};

/** The same, for a page that only exists relative to some project. */
export type ProjectPage = Omit<CommandLink, 'href'> & { segment: string };

/**
 * The projects the viewer can reach, reduced to what the command bar renders.
 *
 * Deliberately plain data. The bar is a client component fed from a server
 * one, so nothing here may be a component reference: icons for project pages
 * come from `PROJECT_PAGES` on the client, and the only per-project visual is
 * `platform`, which is a string the platform icon resolves at render time.
 */
export type CommandProject = {
  id: number;
  name: string;
  platform: string | null;
};

/**
 * How many projects the command bar carries.
 *
 * A deliberate scope, not an accident of the default page size. The bar is
 * rendered by the layout, so its projects read runs on *every* authenticated
 * page: paging to exhaustion would turn one request per navigation into one
 * per hundred projects, to populate a palette that already caps how many rows
 * it will show. An instance past this many projects needs the search to move
 * server-side, which is a different change to making this number bigger.
 */
export const COMMAND_BAR_PROJECT_LIMIT = 100;

/** Every project's own pages, in the order the bar lists them. */
const PROJECT_PAGES: ProjectPage[] = [
  {
    label: 'Overview',
    segment: '',
    description: 'Health, volume and the latest issues at a glance.',
    icon: LayoutDashboardIcon,
    keywords: ['dashboard', 'home'],
  },
  {
    label: 'Issues',
    segment: '/issues',
    description: 'Errors and exceptions, grouped by fingerprint.',
    icon: BugIcon,
    keywords: ['errors', 'exceptions', 'crashes'],
  },
  {
    label: 'Releases',
    segment: '/releases',
    description: 'Deploys and the health of each version.',
    icon: RocketIcon,
    keywords: ['deploys', 'versions', 'health', 'sessions'],
  },
  {
    label: 'Performance',
    segment: '/performance',
    description: 'Transaction timings and span waterfalls.',
    icon: GaugeIcon,
    keywords: ['apm', 'transactions', 'spans', 'traces', 'latency'],
  },
  {
    label: 'Agents',
    segment: '/agents',
    description: 'AI agent traces and the spans inside them.',
    icon: BotIcon,
    keywords: ['ai', 'llm', 'traces'],
  },
  {
    label: 'Logs',
    segment: '/logs',
    description: 'The raw log stream as it arrives.',
    icon: ScrollTextIcon,
    keywords: ['stream'],
  },
];

/**
 * Kept as their own list so the two intents stay distinguishable in source --
 * navigating to a project's issues and reconfiguring it are different things.
 * The preview column reads them through `ALL_PROJECT_PAGES`, below.
 */
const PROJECT_SETTINGS_PAGES: ProjectPage[] = [
  {
    label: 'General',
    segment: '/settings/general',
    description: 'Name, slug, platform and the danger zone.',
    icon: SettingsIcon,
    keywords: ['rename', 'slug', 'delete'],
  },
  {
    label: 'Alerts',
    segment: '/settings/alerts',
    description: 'Rules that fire when something breaks.',
    icon: BellIcon,
    keywords: ['rules', 'notifications'],
  },
  {
    label: 'Members',
    segment: '/settings/members',
    description: 'Who has access to this project, and as what.',
    icon: UsersIcon,
    keywords: ['access', 'roles', 'permissions'],
  },
  {
    label: 'Client keys',
    segment: '/settings/client-keys',
    description: 'The DSN and the SDK setup snippet.',
    icon: KeyRoundIcon,
    keywords: ['dsn', 'sdk', 'setup', 'install'],
  },
];

/** Every page a project has, in the order the preview column lists them. */
export const ALL_PROJECT_PAGES: ProjectPage[] = [
  ...PROJECT_PAGES,
  ...PROJECT_SETTINGS_PAGES,
];

/** How many rows a project's drill-down holds, shown on its collapsed row. */
export const PROJECT_PAGE_COUNT = ALL_PROJECT_PAGES.length;

/** Commands about projects in general rather than about one of them. */
export const PROJECT_COMMANDS: CommandLink[] = [
  {
    label: 'All projects',
    href: '/projects',
    description: 'Every project on this instance you can see.',
    icon: FolderIcon,
    keywords: ['list', 'browse'],
  },
  {
    label: 'New project',
    href: '/projects/new',
    description: 'Pick a platform and create one.',
    icon: PlusIcon,
    keywords: ['create', 'add'],
  },
];

/** The instance-wide settings, which exist regardless of what it contains. */
export const SETTINGS_COMMANDS: CommandLink[] = [
  {
    label: 'API tokens',
    href: '/settings/tokens',
    description: 'Bearer tokens for the API and for SDK ingestion.',
    icon: KeyIcon,
    keywords: ['auth', 'bearer', 'secret'],
  },
  {
    label: 'Integrations',
    href: '/settings/integrations',
    description: 'Where alerts get delivered.',
    icon: PlugIcon,
    keywords: ['slack', 'webhook', 'email'],
  },
  {
    label: 'Team',
    href: '/settings/team',
    description: 'Members of this instance and pending invitations.',
    icon: UsersIcon,
    keywords: ['invite', 'people'],
  },
  {
    label: 'Storage',
    href: '/settings/storage',
    description: 'Retention windows and source map cleanup.',
    icon: DatabaseIcon,
    keywords: ['retention', 'cleanup', 'source maps', 'disk'],
  },
  {
    label: 'Account',
    href: '/settings/account',
    description: 'Your own profile and password.',
    icon: UserIcon,
    keywords: ['profile', 'password', 'me', 'logout'],
  },
  {
    label: 'Appearance',
    href: '/settings/appearance',
    description: 'Light, dark or whatever the system says.',
    icon: PaletteIcon,
    keywords: ['theme', 'dark', 'light'],
  },
  {
    label: 'About',
    href: '/settings/about',
    description: 'Which version of Rustrak this is.',
    icon: InfoIcon,
    keywords: ['version', 'build'],
  },
];
