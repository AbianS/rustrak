import {
  Page,
  PageHeader,
  SegmentedControl,
  SegmentedItem,
  Tag,
  Text,
} from '@rustrak/ui';
import {
  createFileRoute,
  useLoaderData,
  useNavigate,
} from '@tanstack/react-router';
import { CrashFree } from '../../../../components/project/overview/crash-free';
import { ErrorVolume } from '../../../../components/project/overview/error-volume';
import { Headline } from '../../../../components/project/overview/headline';
import { ReleaseHealth } from '../../../../components/project/overview/release-health';
import { Slowest } from '../../../../components/project/overview/slowest';
import { TopIssues } from '../../../../components/project/overview/top-issues';
import {
  bucketHours,
  DEFAULT_PERIOD,
  PERIOD_LABELS,
  PERIODS,
  type Period,
  validPeriod,
} from '../../../../lib/period';
import { rustrak } from '../../../../lib/rustrak';

/** The two lists are a top five; the transactions are sorted here, so ask wider. */
const TOP = 5;
const TRANSACTION_SAMPLE = 20;

interface OverviewSearch {
  period?: Period;
}

export const Route = createFileRoute('/_authenticated/projects/$id/')({
  validateSearch: (search: Record<string, unknown>): OverviewSearch => {
    const period = validPeriod(search.period);
    return period ? { period } : {};
  },
  loaderDeps: ({ search }) => search,
  /*
   * Seven requests, issued together and awaited together.
   *
   * Every one of them returns a `Result` and none of them throws, so a tile
   * whose endpoint is down loses that tile and nothing else. That is the whole
   * reason they are not chained: an overview where one slow query holds up the
   * other six is an overview nobody waits for.
   */
  loader: async ({ deps, params }) => {
    const projectId = Number(params.id);
    const period = deps.period ?? DEFAULT_PERIOD;
    const interval = bucketHours(period);

    const [
      stats,
      events,
      sessions,
      sessionTrend,
      issues,
      transactions,
      releases,
    ] = await Promise.all([
      rustrak.stats.summary(projectId, period),
      rustrak.stats.timeseries(projectId, period, interval),
      rustrak.sessions.summary(projectId, period),
      rustrak.sessions.timeseries(projectId, period, interval),
      rustrak.issues.list(projectId, {
        filter: 'open',
        page: 1,
        per_page: TOP,
        sort: 'event_count',
        order: 'desc',
      }),
      rustrak.transactions.getStats(projectId, {
        page: 1,
        per_page: TRANSACTION_SAMPLE,
      }),
      rustrak.sessions.stats(projectId, { period, page: 1, per_page: TOP }),
    ]);

    return {
      projectId,
      period,
      stats,
      events,
      sessions,
      sessionTrend,
      issues,
      transactions,
      releases,
    };
  },
  component: Overview,
});

function Overview() {
  const data = Route.useLoaderData();
  const { t, project } = useLoaderData({
    from: '/_authenticated/projects/$id',
  });
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const period = search.period ?? DEFAULT_PERIOD;
  const periodLabel = t.t(PERIOD_LABELS[period]);

  return (
    <Page>
      <PageHeader
        actions={
          <SegmentedControl
            aria-label={t.t('projectOverview.period')}
            onValueChange={(value) =>
              navigate({
                search: { period: validPeriod(value) },
                replace: true,
              })
            }
            value={period}
          >
            {PERIODS.map((option) => (
              <SegmentedItem key={option} value={option}>
                {t.t(PERIOD_LABELS[option])}
              </SegmentedItem>
            ))}
          </SegmentedControl>
        }
        /*
         * The project's name is not repeated here. The sidebar card carries it
         * and the trail above says it again; a third copy as the page title
         * leaves the heading saying nothing about which of the seven screens
         * you are on.
         */
        meta={
          project.success ? (
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <Text tone="ghost" truncate variant="mono-sm">
                {project.data.slug}
              </Text>
              {project.data.platform ? (
                <Tag tone="neutral" variant="soft">
                  {project.data.platform}
                </Tag>
              ) : null}
            </div>
          ) : null
        }
        title={t.t('projectOverview.title')}
      />

      <Headline
        projectId={data.projectId}
        sessions={data.sessions.success ? data.sessions.data : null}
        stats={data.stats.success ? data.stats.data : null}
        t={t}
      />

      {/*
        Three columns from `xl`, one below it, and nothing in between: the
        charts need roughly 400 px before the axis labels start colliding, so a
        two-column tablet layout would put both of them under their own
        breakpoint. The lists are what pair with a chart, and they pair at the
        width where the chart is already readable.
      */}
      <div className="grid min-w-0 gap-3 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <ErrorVolume
            data={data.events.success ? data.events.data : []}
            period={period}
            periodLabel={periodLabel}
            t={t}
          />
        </div>

        <div className="min-w-0">
          <CrashFree
            period={period}
            summary={data.sessions.success ? data.sessions.data : null}
            t={t}
            trend={data.sessionTrend.success ? data.sessionTrend.data : []}
          />
        </div>

        <div className="min-w-0 xl:col-span-2">
          <TopIssues
            issues={data.issues.success ? data.issues.data.items : []}
            projectId={data.projectId}
            t={t}
          />
        </div>

        <div className="min-w-0">
          <ReleaseHealth
            projectId={data.projectId}
            rows={data.releases.success ? data.releases.data.items : []}
            t={t}
          />
        </div>

        <div className="min-w-0 xl:col-span-3">
          <Slowest
            t={t}
            transactions={
              data.transactions.success ? data.transactions.data.items : []
            }
          />
        </div>
      </div>
    </Page>
  );
}
