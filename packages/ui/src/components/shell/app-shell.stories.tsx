import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Breadcrumbs } from '../breadcrumbs/breadcrumbs';
import { Button } from '../button/button';
import { SplitButton } from '../button/split-button';
import { Count } from '../count/count';
import {
  AgentsIcon,
  AssignIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExportIcon,
  IssuesIcon,
  LogsIcon,
  MuteIcon,
  NewIcon,
  NotificationIcon,
  OverflowIcon,
  OverviewIcon,
  PerformanceIcon,
  ReleasesIcon,
  ResolveIcon,
  SettingsIcon,
} from '../icon/icon-catalog';
import {
  SegmentedControl,
  SegmentedItem,
} from '../segmented-control/segmented-control';
import { Tab, TabList, TabPanel, Tabs } from '../tabs/tabs';
import { Tag } from '../tag/tag';
import { Text } from '../text/text';
import { AppShell, Page, PageHeader, SubHeader } from './app-shell';
import {
  Sidebar,
  SidebarCollapseButton,
  SidebarItem,
  SidebarProject,
} from './sidebar';
import {
  Topbar,
  TopbarAction,
  TopbarBrand,
  TopbarMenuButton,
  TopbarSearch,
  TopbarUser,
} from './topbar';

/*
 * These are composition stories rather than props stories: what they check is
 * that the frame, the sidebar, the tabs and the buttons still add up to the
 * screens of the product. `Meta` is left ungenericised on purpose -- typing it
 * to `AppShell` would demand `args` on every story, and none of them has an
 * argument to give.
 */
const meta = {
  title: 'Shell/AppShell',
  parameters: { layout: 'fullscreen', controls: { disable: true } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const ROUTES = [
  { icon: OverviewIcon, label: 'Overview' },
  { icon: IssuesIcon, label: 'Issues', count: '143' },
  { icon: ReleasesIcon, label: 'Releases' },
  { icon: PerformanceIcon, label: 'Performance' },
  { icon: AgentsIcon, label: 'Agents' },
  { icon: LogsIcon, label: 'Logs' },
  { icon: SettingsIcon, label: 'Settings' },
] as const;

function Frame({
  active = 'Issues',
  children,
}: {
  active?: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell
      topbar={
        <Topbar
          menu={<TopbarMenuButton />}
          brand={<TopbarBrand render={<a href="#home" />} />}
          actions={
            <>
              <TopbarSearch />
              <TopbarAction
                icon={NotificationIcon}
                aria-label="Notifications"
                count={3}
              />
              <TopbarUser
                name="María López"
                email="maria@acme.dev"
                version="rustrak 0.14.7"
                actions={[
                  { id: 'account', label: 'Account' },
                  { id: 'prefs', label: 'Preferences' },
                  { id: 'docs', label: 'Documentation' },
                  {
                    id: 'signout',
                    label: 'Sign out',
                    tone: 'danger',
                    separated: true,
                  },
                ]}
              />
            </>
          }
        />
      }
      sidebar={
        <Sidebar
          header={
            <SidebarProject
              name="Checkout API"
              organisation="Acme Corp"
              platform="JS"
            />
          }
          footer={<SidebarCollapseButton />}
        >
          {ROUTES.map((route) => (
            <SidebarItem
              key={route.label}
              icon={route.icon}
              label={route.label}
              count={'count' in route ? route.count : undefined}
              active={route.label === active}
              render={<a href={`#${route.label.toLowerCase()}`} />}
            />
          ))}
        </Sidebar>
      }
    >
      {children}
    </AppShell>
  );
}

const ISSUES = [
  {
    tone: 'error',
    level: 'error',
    title: "TypeError: Cannot read properties of undefined (reading 'total')",
    tag: 'regression',
    where: 'src/checkout/summary.tsx · renderTotals · CHECKOUT-API-4F2',
    events: '12.431',
    seen: '3 min ago',
  },
  {
    tone: 'error',
    level: 'fatal',
    title: 'ConnectionTimeout: pool exhausted after 30000ms',
    where: 'db/pool.rs · acquire · CHECKOUT-API-3B1',
    events: '3.902',
    seen: '12 min ago',
  },
  {
    tone: 'warning',
    level: 'warn',
    title: 'ValidationError: coupon code not applicable',
    tag: 'new',
    where: 'src/promo/apply.ts · applyCoupon · CHECKOUT-API-2C8',
    events: '1.204',
    seen: '38 min ago',
  },
  {
    tone: 'info',
    level: 'info',
    title: 'DeprecationWarning: legacy shipping API called',
    where: 'src/shipping/legacy.ts · quote · CHECKOUT-API-1D5',
    events: '288',
    seen: '5 h ago',
  },
] as const;

function IssueList() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border-subtle bg-panel">
      <div className="flex h-row-head shrink-0 items-center gap-3 border-b border-border-subtle bg-surface px-4">
        <Text variant="column" tone="meta" className="w-12 shrink-0">
          Level
        </Text>
        <Text variant="column" tone="meta" className="flex-1">
          Issue
        </Text>
        <Text variant="column" tone="meta" className="w-20 shrink-0 text-end">
          Events
        </Text>
        <Text variant="column" tone="meta" className="w-24 shrink-0 text-end">
          Last seen
        </Text>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {ISSUES.map((issue) => (
          <div
            key={issue.title}
            className="flex h-row items-center gap-3 border-b border-border-divider px-4 hover:bg-surface"
          >
            <span className="w-12 shrink-0">
              <Tag tone={issue.tone}>{issue.level}</Tag>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex min-w-0 items-center gap-2.5">
                <Text variant="value" truncate className="font-semibold">
                  {issue.title}
                </Text>
                {'tag' in issue && issue.tag ? (
                  <Tag tone={issue.tag === 'new' ? 'brand' : 'warning'}>
                    {issue.tag}
                  </Tag>
                ) : null}
              </span>
              <Text variant="mono-sm" tone="ghost" truncate>
                {issue.where}
              </Text>
            </span>
            <span className="w-20 shrink-0 text-end">
              <Count tone="strong">{issue.events}</Count>
            </span>
            <span className="w-24 shrink-0 text-end">
              <Count>{issue.seen}</Count>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The organisation-level frame: no sidebar.
 *
 * The projects list and settings are not scoped to one project, so there is
 * nothing to navigate *within*. A rail of links to elsewhere is decoration,
 * and the content takes the width instead. `TopbarMenuButton` goes with it:
 * it opens the sidebar drawer, and there is no drawer here.
 */
export const NoSidebar: Story = {
  render: () => (
    <AppShell
      topbar={
        <Topbar
          brand={<TopbarBrand render={<a href="#home" />} />}
          actions={
            <>
              <TopbarSearch />
              <TopbarUser
                name="Mar\u00eda L\u00f3pez"
                email="maria@acme.dev"
                actions={[{ id: 'signout', label: 'Sign out', tone: 'danger' }]}
              />
            </>
          }
        />
      }
    >
      <Page>
        <PageHeader
          title="Projects"
          meta={
            <Text variant="body" tone="tertiary">
              6 projects
            </Text>
          }
          actions={
            <Button variant="primary" icon={NewIcon}>
              New project
            </Button>
          }
        />
        <IssueList />
      </Page>
    </AppShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole('heading', { name: 'Projects' }),
    ).toBeVisible();
    // No rail, so nothing announces itself as navigation.
    await expect(canvas.queryByRole('navigation')).not.toBeInTheDocument();
  },
};

/** The list screen: the frame, a title, the views, and rows. */
export const IssueListScreen: Story = {
  render: () => (
    <Frame>
      <Page scroll={false}>
        <PageHeader
          title="Issues"
          meta={
            <Text variant="mono-sm" tone="ghost">
              checkout-api · web@2026.8.1 · production
            </Text>
          }
          actions={
            <>
              <SegmentedControl defaultValue="24 h" aria-label="Time range">
                {['1 h', '24 h', '7 d', '30 d'].map((range) => (
                  <SegmentedItem key={range} value={range}>
                    {range}
                  </SegmentedItem>
                ))}
              </SegmentedControl>
              <Button variant="secondary" icon={ExportIcon}>
                Export
              </Button>
              <Button variant="primary" icon={NewIcon}>
                New project
              </Button>
            </>
          }
        />

        <Tabs defaultValue="unresolved" className="min-h-0 flex-1">
          <TabList
            meta={
              <Text variant="mono-sm" tone="placeholder">
                sort: events desc
              </Text>
            }
          >
            <Tab value="unresolved">
              Unresolved
              <Count>143</Count>
            </Tab>
            <Tab value="resolved">
              Resolved
              <Count>1.208</Count>
            </Tab>
            <Tab value="muted">
              Muted
              <Count>36</Count>
            </Tab>
          </TabList>
          <TabPanel value="unresolved" className="flex min-h-0 flex-1">
            <IssueList />
          </TabPanel>
          <TabPanel value="resolved" />
          <TabPanel value="muted" />
        </Tabs>
      </Page>
    </Frame>
  ),
};

/** The record screen: the sub-header, the primary action, the record's tabs. */
export const IssueDetailScreen: Story = {
  render: () => (
    <Frame>
      <SubHeader
        actions={
          <>
            <Count>12 of 143</Count>
            <Button
              size="xs"
              variant="secondary"
              icon={ChevronLeftIcon}
              aria-label="Previous issue"
            />
            <Button
              size="xs"
              variant="secondary"
              icon={ChevronRightIcon}
              aria-label="Next issue"
            />
          </>
        }
      >
        <Breadcrumbs
          items={[
            { label: 'Issues', render: <a href="#issues" /> },
            { label: 'CHECKOUT-API-4F2' },
          ]}
        />
      </SubHeader>

      <Page scroll={false}>
        <div className="flex shrink-0 items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2.5">
              <Tag tone="error">error</Tag>
              <Tag tone="warning">regression</Tag>
              <Text variant="mono-sm" tone="ghost">
                unhandled · production · eu-west-1
              </Text>
            </div>
            <h1 className="flex min-w-0 items-baseline gap-2.5 text-title text-fg">
              TypeError
              <Text variant="mono" tone="muted" truncate>
                Cannot read properties of undefined (reading 'total')
              </Text>
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <SplitButton
              icon={ResolveIcon}
              menuLabel="More ways to resolve"
              actions={[
                { id: 'next', label: 'Resolve in the next release' },
                { id: 'again', label: 'Resolve until it happens again' },
                { id: 'assign', label: 'Assign and resolve', icon: AssignIcon },
              ]}
            >
              Resolve
            </SplitButton>
            <Button variant="secondary" icon={MuteIcon}>
              Mute
            </Button>
            <Button
              variant="ghost"
              icon={OverflowIcon}
              aria-label="More actions"
            />
          </div>
        </div>

        <Tabs defaultValue="details" className="min-h-0 flex-1">
          <TabList>
            <Tab size="sm" value="details">
              Details
            </Tab>
            <Tab size="sm" value="events">
              Events
              <Count>12,4 K</Count>
            </Tab>
            <Tab size="sm" value="breadcrumbs">
              Breadcrumbs
            </Tab>
            <Tab size="sm" value="traces">
              Traces
            </Tab>
          </TabList>
          <TabPanel value="details">
            <Text tone="muted">The stack, the tags, the release.</Text>
          </TabPanel>
          <TabPanel value="events" />
          <TabPanel value="breadcrumbs" />
          <TabPanel value="traces" />
        </Tabs>
      </Page>
    </Frame>
  ),
};

/** The rail. Collapsed, every route keeps its name in a tooltip. */
export const CollapsedSidebar: Story = {
  render: () => (
    <AppShell
      defaultCollapsed
      topbar={<Topbar brand={<TopbarBrand />} actions={<TopbarSearch />} />}
      sidebar={
        <Sidebar
          header={
            <SidebarProject
              name="Checkout API"
              organisation="Acme Corp"
              platform="JS"
            />
          }
          footer={<SidebarCollapseButton />}
        >
          {ROUTES.map((route) => (
            <SidebarItem
              key={route.label}
              icon={route.icon}
              label={route.label}
              count={'count' in route ? route.count : undefined}
              active={route.label === 'Overview'}
              render={<a href={`#${route.label.toLowerCase()}`} />}
            />
          ))}
        </Sidebar>
      }
    >
      <Page>
        <PageHeader title="Overview" />
      </Page>
    </AppShell>
  ),
};

/** ⌘B collapses it, and the button says which state it is in. */
export const TheShortcutCollapsesIt: Story = {
  render: () => (
    <Frame active="Overview">
      <Page>
        <PageHeader title="Overview" />
      </Page>
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const collapse = canvas.getByRole('button', { name: 'Collapse sidebar' });

    await expect(collapse).toHaveAttribute('aria-expanded', 'true');

    await userEvent.keyboard('{Meta>}b{/Meta}');

    await expect(
      await canvas.findByRole('button', { name: 'Expand sidebar' }),
    ).toHaveAttribute('aria-expanded', 'false');
  },
};

/** The route you are on says so to a screen reader, not only in lime. */
export const TheActiveRouteIsAnnounced: Story = {
  render: () => (
    <Frame>
      <Page>
        <PageHeader title="Issues" />
      </Page>
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole('navigation', {
      name: 'Main navigation',
    });

    await expect(
      within(nav).getByRole('link', { name: /Issues/ }),
    ).toHaveAttribute('aria-current', 'page');
  },
};

/** Nothing in the frame scrolls except the content. */
export const OnlyTheContentScrolls: Story = {
  render: () => (
    <Frame active="Logs">
      <Page>
        <PageHeader title="Logs" />
        {Array.from({ length: 60 }, (_, index) => (
          <Text key={index} variant="mono-sm" tone="muted">
            2026-08-23 11:0{index % 10}:37 · checkout-api · request completed
          </Text>
        ))}
      </Page>
    </Frame>
  ),
};
