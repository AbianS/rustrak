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
 * `labelKey` and `descriptionKey` are message keys resolved at render time,
 * so the bar reads in the viewer's language. `keywords` is the opposite:
 * never rendered, it only widens what the matcher accepts, so "logout" reaches
 * Account and "apm" reaches Performance without those words on screen. The
 * search index is English-only by design: platform and product vocabulary,
 * which is what these aliases carry, does not get translated.
 */
export type CommandLink = {
  labelKey: string;
  href: string;
  descriptionKey: string;
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
    labelKey: 'commands.overview',
    segment: '',
    descriptionKey: 'commands.overviewDescription',
    icon: LayoutDashboardIcon,
    keywords: ['dashboard', 'home'],
  },
  {
    labelKey: 'commands.issues',
    segment: '/issues',
    descriptionKey: 'commands.issuesDescription',
    icon: BugIcon,
    keywords: ['errors', 'exceptions', 'crashes'],
  },
  {
    labelKey: 'commands.releases',
    segment: '/releases',
    descriptionKey: 'commands.releasesDescription',
    icon: RocketIcon,
    keywords: ['deploys', 'versions', 'health', 'sessions'],
  },
  {
    labelKey: 'commands.performance',
    segment: '/performance',
    descriptionKey: 'commands.performanceDescription',
    icon: GaugeIcon,
    keywords: ['apm', 'transactions', 'spans', 'traces', 'latency'],
  },
  {
    labelKey: 'commands.agents',
    segment: '/agents',
    descriptionKey: 'commands.agentsDescription',
    icon: BotIcon,
    keywords: ['ai', 'llm', 'traces'],
  },
  {
    labelKey: 'commands.logs',
    segment: '/logs',
    descriptionKey: 'commands.logsDescription',
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
    labelKey: 'commands.general',
    segment: '/settings/general',
    descriptionKey: 'commands.generalDescription',
    icon: SettingsIcon,
    keywords: ['rename', 'slug', 'delete'],
  },
  {
    labelKey: 'commands.alerts',
    segment: '/settings/alerts',
    descriptionKey: 'commands.alertsDescription',
    icon: BellIcon,
    keywords: ['rules', 'notifications'],
  },
  {
    labelKey: 'commands.members',
    segment: '/settings/members',
    descriptionKey: 'commands.membersDescription',
    icon: UsersIcon,
    keywords: ['access', 'roles', 'permissions'],
  },
  {
    labelKey: 'commands.clientKeys',
    segment: '/settings/client-keys',
    descriptionKey: 'commands.clientKeysDescription',
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
    labelKey: 'commands.allProjects',
    href: '/projects',
    descriptionKey: 'commands.allProjectsDescription',
    icon: FolderIcon,
    keywords: ['list', 'browse'],
  },
  {
    labelKey: 'commands.newProject',
    href: '/projects/new',
    descriptionKey: 'commands.newProjectDescription',
    icon: PlusIcon,
    keywords: ['create', 'add'],
  },
];

/** The instance-wide settings, which exist regardless of what it contains. */
export const SETTINGS_COMMANDS: CommandLink[] = [
  {
    labelKey: 'commands.apiTokens',
    href: '/settings/tokens',
    descriptionKey: 'commands.apiTokensDescription',
    icon: KeyIcon,
    keywords: ['auth', 'bearer', 'secret'],
  },
  {
    labelKey: 'commands.integrations',
    href: '/settings/integrations',
    descriptionKey: 'commands.integrationsDescription',
    icon: PlugIcon,
    keywords: ['slack', 'webhook', 'email'],
  },
  {
    labelKey: 'commands.team',
    href: '/settings/team',
    descriptionKey: 'commands.teamDescription',
    icon: UsersIcon,
    keywords: ['invite', 'people'],
  },
  {
    labelKey: 'commands.storage',
    href: '/settings/storage',
    descriptionKey: 'commands.storageDescription',
    icon: DatabaseIcon,
    keywords: ['retention', 'cleanup', 'source maps', 'disk'],
  },
  {
    labelKey: 'commands.account',
    href: '/settings/account',
    descriptionKey: 'commands.accountDescription',
    icon: UserIcon,
    keywords: ['profile', 'password', 'me', 'logout'],
  },
  {
    labelKey: 'commands.appearance',
    href: '/settings/appearance',
    descriptionKey: 'commands.appearanceDescription',
    icon: PaletteIcon,
    keywords: ['theme', 'dark', 'light'],
  },
  {
    labelKey: 'commands.about',
    href: '/settings/about',
    descriptionKey: 'commands.aboutDescription',
    icon: InfoIcon,
    keywords: ['version', 'build'],
  },
];
