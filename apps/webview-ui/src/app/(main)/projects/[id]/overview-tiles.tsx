import { listIssues } from '@/actions/issues';
import { getSessionSummary, getSessionTimeseries } from '@/actions/sessions';
import {
  getProjectEventTimeseries,
  getProjectStatsSummary,
} from '@/actions/stats';
import { getTransactionStats } from '@/actions/transactions';
import { CrashFreeTrend } from '@/components/charts/crash-free-trend';
import { ErrorVolumeChart } from '@/components/charts/error-volume-chart';
import { SessionHealthArea } from '@/components/charts/session-health-area';
import { StatTile } from '@/components/charts/stat-tile';
import { TransactionP95Bars } from '@/components/charts/transaction-p95-bars';
import { IssueListCard } from '@/components/issue-list-card';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { exactCount } from '@/lib/chart-format';
import { type OverviewPeriod, overviewInterval } from '@/lib/session-health';

/**
 * Every tile takes the same props so the grid can stream them independently:
 * each one owns its own fetch and sits behind its own Suspense boundary,
 * rather than the page blocking on the slowest query before anything paints.
 */
interface TileProps {
  projectId: number;
  period?: OverviewPeriod;
}

function TileShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </CardTitle>
        {subtitle ? (
          <CardDescription className="text-xs">{subtitle}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Placeholder that holds the tile's footprint while its query resolves. */
export function TileSkeleton({ height = 140 }: { height?: number }) {
  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <Skeleton className="h-3 w-28" />
      </CardHeader>
      <CardContent>
        <Skeleton className="w-full" style={{ height }} />
      </CardContent>
    </Card>
  );
}

export async function ErrorVolumeTile({ projectId, period }: TileProps) {
  const timeseries = await getProjectEventTimeseries(
    projectId,
    period,
    overviewInterval(period),
  );

  return (
    <TileShell title="Error volume by severity">
      <ErrorVolumeChart data={timeseries} />
    </TileShell>
  );
}

export async function CounterTiles({ projectId, period }: TileProps) {
  const summary = await getProjectStatsSummary(projectId, period);

  return (
    <>
      <StatTile label="Events" metric={summary.events} polarity="up-is-bad" />
      <StatTile
        label="New issues"
        metric={summary.new_issues}
        polarity="up-is-bad"
        footnote={`${exactCount(summary.open_issues)} open`}
      />
    </>
  );
}

export async function CrashFreeTile({ projectId, period }: TileProps) {
  // The headline rates and the shape behind them come from two endpoints, so
  // they are fetched together rather than split across two Suspense
  // boundaries: half the tile arriving before the other half would flash.
  const [summary, timeseries] = await Promise.all([
    getSessionSummary(projectId, period),
    getSessionTimeseries(projectId, period, overviewInterval(period)),
  ]);

  return (
    <TileShell title="Crash-free sessions">
      <CrashFreeTrend
        sessionsRate={summary.crash_free_sessions_rate}
        usersRate={summary.crash_free_users_rate}
        totalSessions={summary.total}
        data={timeseries}
      />
    </TileShell>
  );
}

export async function SessionHealthTile({ projectId, period }: TileProps) {
  const timeseries = await getSessionTimeseries(
    projectId,
    period,
    overviewInterval(period),
  );

  return (
    <TileShell
      title="Session health"
      subtitle="Healthy and crashed sessions over time"
    >
      <SessionHealthArea data={timeseries} height={220} />
    </TileShell>
  );
}

export async function PerformanceTile({ projectId }: TileProps) {
  // Transaction stats have no period filter of their own yet, so this tile is
  // all-time regardless of the selected window. Said out loud in the subtitle
  // rather than silently pretending to follow the filter.
  const stats = await getTransactionStats(projectId, { page: 1, per_page: 20 });

  return (
    <TileShell title="Latency" subtitle="Slowest transactions by p95, all time">
      <TransactionP95Bars projectId={projectId} rows={stats.items} />
    </TileShell>
  );
}

export async function TopIssuesTile({ projectId }: TileProps) {
  // The issues endpoint takes no time window, and `event_count` is the issue's
  // lifetime total, so this ranking is all-time whatever the page filter says.
  // Labelled rather than left to look like it follows the filter, the same way
  // the latency tile is.
  const response = await listIssues(projectId, {
    filter: 'open',
    page: 1,
    per_page: 5,
    sort: 'event_count',
    order: 'desc',
  });

  return (
    <IssueListCard
      projectId={projectId}
      issues={response.items}
      title="Top issues"
      subtitle="Open issues by total events, all time"
      emptyMessage="No issues yet"
    />
  );
}
