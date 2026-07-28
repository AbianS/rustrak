import type { MetricDelta } from '@rustrak/client';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import {
  compactCount,
  exactCount,
  formatPercentChange,
  percentChange,
} from '@/shared/lib/chart-format';
import { cn } from '@/shared/lib/utils';
import { deltaTone, type Polarity } from '@/shared/ui/metric-delta';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/ui/shadcn/card';

interface StatTileProps {
  label: string;
  metric: MetricDelta;
  polarity: Polarity;
  /** Sub-label under the value, e.g. the backlog the rate feeds. */
  footnote?: string;
}

/**
 * A headline number with its period-over-period change. The KPI primitive of
 * the overview grid: a single current value plus a trend is a stat tile, not a
 * one-bar bar chart.
 */
export function StatTile({ label, metric, polarity, footnote }: StatTileProps) {
  const change = percentChange(metric.current, metric.previous);
  const Arrow =
    change === null || change === 0
      ? ArrowRight
      : change > 0
        ? ArrowUpRight
        : ArrowDownRight;

  return (
    <Card size="sm" className="justify-between">
      <CardHeader>
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        {/* Proportional figures, not tabular: at this size tabular digits give
            every glyph the width of a zero and the number reads loose. Tabular
            is for columns that have to align. */}
        <p
          className="text-3xl font-bold leading-none"
          title={exactCount(metric.current)}
        >
          {compactCount(metric.current)}
        </p>
        {change === null ? (
          <span className="text-xs text-muted-foreground">
            {metric.previous === null ? 'No prior period' : 'No prior activity'}
          </span>
        ) : (
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium tabular-nums',
              deltaTone(change, polarity),
            )}
          >
            <Arrow className="size-3.5" aria-hidden />
            {formatPercentChange(change)}
            <span className="font-normal text-muted-foreground">vs prev</span>
          </span>
        )}
        {footnote ? (
          <span className="text-xs text-muted-foreground">{footnote}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}
