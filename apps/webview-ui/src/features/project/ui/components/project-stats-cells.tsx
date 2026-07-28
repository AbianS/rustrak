import type { ProjectListStats } from '@rustrak/client';
import { PROJECT_COLUMNS } from '@/features/project/model/columns';
import { compactCount, exactCount } from '@/shared/lib/chart-format';
import { cn } from '@/shared/lib/utils';
import { MetricDeltaText } from '@/shared/ui/components/metric-delta';
import { TrendSparkline } from '@/shared/ui/components/trend-sparkline';

/**
 * Floor for the sparkline's y-axis.
 *
 * Lower than the events equivalent would be, because this counts issues:
 * three concurrent issues is a busy hour for one project, where three events
 * is nothing. Without a floor at all, one issue firing alone draws a
 * full-height bar identical to a project in meltdown.
 */
const TREND_MIN_SCALE = 4;

/**
 * How alarming this project looks at a glance.
 *
 * Ordered by severity, and deliberately not derived from event volume: a
 * single chatty issue can multiply events without anything new being broken,
 * so volume is the wrong thing to colour a row by.
 */
type ProjectHealth = 'critical' | 'rising' | 'quiet';

const HEALTH_BARS: Record<ProjectHealth, string> = {
  critical: 'fill-red-500/80 dark:fill-red-400/80',
  rising: 'fill-amber-500/80 dark:fill-amber-400/80',
  quiet: 'fill-muted-foreground/40',
};

const HEALTH_LABELS: Record<ProjectHealth, string> = {
  critical: 'Active issues, fatal errors open',
  rising: 'Active issues, more new issues than the previous period',
  quiet: 'Active issues, steady',
};

function projectHealth(stats: ProjectListStats): ProjectHealth {
  if (stats.fatal_issues > 0) {
    return 'critical';
  }
  const { current, previous } = stats.new_issues;
  // `previous === null` means an all-time request with nothing to compare
  // against, which is not evidence of a rise. A previous of zero is, though.
  if (previous !== null && current > previous) {
    return 'rising';
  }
  return 'quiet';
}

interface ProjectStatsCellsProps {
  /**
   * Absent when the list was fetched without `stats_period`. Rendered as an
   * explicit blank rather than as zeros, which would claim the project is
   * quiet when the truth is that nobody asked.
   */
  stats: ProjectListStats | undefined;
  /** Lifetime digested events, from the project row itself. */
  totalEvents: number;
}

/** The Issues / Events / Total / Trend cells of one project row. */
export function ProjectStatsCells({
  stats,
  totalEvents,
}: ProjectStatsCellsProps) {
  const health = stats ? projectHealth(stats) : 'quiet';

  return (
    <>
      <div className={PROJECT_COLUMNS.issues}>
        {stats ? (
          <>
            <div
              className={cn(
                'text-sm font-medium tabular-nums',
                stats.open_issues === 0 && 'text-muted-foreground',
              )}
            >
              {exactCount(stats.open_issues)}
            </div>
            {stats.fatal_issues > 0 && (
              <div className="text-xs font-medium text-red-600 dark:text-red-400 tabular-nums">
                {stats.fatal_issues} fatal
              </div>
            )}
          </>
        ) : (
          <span className="text-sm text-muted-foreground/50">&ndash;</span>
        )}
      </div>

      <div className={PROJECT_COLUMNS.events}>
        {stats ? (
          <>
            <div
              className={cn(
                'text-sm font-medium tabular-nums',
                stats.events.current === 0 && 'text-muted-foreground',
              )}
              title={exactCount(stats.events.current)}
            >
              {compactCount(stats.events.current)}
            </div>
            {/* More errors than the period before is bad news, so the arrow
                is coloured against the direction of travel. */}
            <MetricDeltaText metric={stats.events} polarity="up-is-bad" />
          </>
        ) : (
          <span className="text-sm text-muted-foreground/50">&ndash;</span>
        )}
      </div>

      <div className={PROJECT_COLUMNS.total}>
        <span
          className="text-sm text-muted-foreground tabular-nums"
          title={exactCount(totalEvents)}
        >
          {compactCount(totalEvents)}
        </span>
      </div>

      <div className={PROJECT_COLUMNS.trend}>
        {stats && (
          <TrendSparkline
            trend={stats.trend}
            minScale={TREND_MIN_SCALE}
            barClassName={HEALTH_BARS[health]}
            label={`${HEALTH_LABELS[health]}, last 24 hours`}
            className="w-full h-9"
          />
        )}
      </div>
    </>
  );
}
