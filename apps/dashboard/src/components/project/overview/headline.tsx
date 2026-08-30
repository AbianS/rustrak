import type { ProjectStatsSummary, SessionSummary } from '@rustrak/client';
import type { Translator } from '@rustrak/i18n';
import { compareMetric, Metric } from '@rustrak/ui';
import { Link } from '@tanstack/react-router';
import { numberFormats } from './format';

interface HeadlineProps {
  projectId: number;
  stats: ProjectStatsSummary | null;
  sessions: SessionSummary | null;
  t: Translator;
}

/**
 * The four figures the rest of the page explains.
 *
 * Two of them carry a comparison and two do not, and that asymmetry is the
 * honest one: events and new issues are counted over the window, so the window
 * before them exists to be compared against. Open issues is a standing total
 * with no window at all, and the session summary reports one period at a time.
 * Inventing a delta for either would be inventing a number.
 */
export function Headline({ projectId, stats, sessions, t }: HeadlineProps) {
  const { integer } = numberFormats(t.locale);
  const vsPrevious = t.t('projectOverview.vsPrevious');

  const events = stats
    ? compareMetric(stats.events.current, stats.events.previous, 'up-is-bad')
    : null;
  const newIssues = stats
    ? compareMetric(
        stats.new_issues.current,
        stats.new_issues.previous,
        'up-is-bad',
      )
    : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric
        caption={events ? undefined : t.t('projectOverview.noPriorPeriod')}
        comparison={events}
        comparisonLabel={vsPrevious}
        label={t.t('projectOverview.metricEvents')}
        value={integer.format(stats?.events.current ?? 0)}
      />

      <Metric
        caption={newIssues ? undefined : t.t('projectOverview.noPriorPeriod')}
        comparison={newIssues}
        comparisonLabel={vsPrevious}
        label={t.t('projectOverview.metricNewIssues')}
        value={integer.format(stats?.new_issues.current ?? 0)}
      />

      {/* The one figure on the page that is a list, so it is the one that
          links: the next question after "how many are open" is "which". */}
      <Metric
        caption={t.t('projectOverview.openIsStanding')}
        label={t.t('projectOverview.metricOpenIssues')}
        render={
          <Link params={{ id: String(projectId) }} to="/projects/$id/issues" />
        }
        value={integer.format(stats?.open_issues ?? 0)}
      />

      {/* The rate itself has its own card: it needs the count it was computed
          from beside it, and a shape under it, neither of which fits here. */}
      <Metric
        caption={t.t('projectOverview.activeReleasesCaption')}
        label={t.t('projectOverview.metricActiveReleases')}
        value={integer.format(sessions?.active_releases ?? 0)}
      />
    </div>
  );
}
