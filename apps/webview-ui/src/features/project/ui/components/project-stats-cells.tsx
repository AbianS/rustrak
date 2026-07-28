import type { ProjectListStats } from '@rustrak/client';
import { compactCount, exactCount } from '@/shared/lib/chart-format';
import { cn } from '@/shared/lib/utils';
import { MetricDeltaText } from '@/shared/ui/components/metric-delta';
import { TrendSparkline } from '@/shared/ui/components/trend-sparkline';

/**
 * Column widths, shared by the header row and the cells.
 *
 * Exported rather than written twice because a header and its cells drifting
 * apart is invisible in review and obvious on screen.
 *
 * Two kinds of column here, deliberately:
 *
 * - The three counters are **fixed width**, so they read as one tight block.
 *   Giving them a `flex-1` share each spreads them over ~150px apiece on a
 *   wide screen, and since their contents are right-aligned the numbers end
 *   up marooned from one another with no relationship left on screen.
 * - The name and the sparkline **absorb the slack**, because they are the
 *   only two cells that get better with more room. That also keeps the
 *   counters off the right edge, which is what made the original layout feel
 *   like everything had been shoved into a corner.
 */
export const PROJECT_COLUMNS = {
  name: 'flex-[3] min-w-0',
  issues: 'hidden sm:block w-20 shrink-0 text-right',
  events: 'hidden md:block w-24 shrink-0 text-right',
  total: 'hidden lg:block w-20 shrink-0 text-right',
  // `pl-6` on top of the row's `gap-4` opens a 40px gutter here. The counters
  // are one group and the chart is another; at the uniform 16px gap the
  // sparkline read as a fourth counter rather than as a separate thing.
  trend: 'hidden lg:block flex-[2] min-w-28 pl-6',
  created: 'hidden xl:block w-28 shrink-0 text-right',
} as const;

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
