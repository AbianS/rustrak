'use client';

import type { SessionTimeseries } from '@rustrak/client';
import { format } from 'date-fns';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { compactCount, exactCount } from '@/shared/lib/chart-format';
import {
  ChartLegend,
  ChartTooltipCaption,
  ChartTooltipRow,
  ChartTooltipSurface,
} from '@/shared/ui/components/chart-tooltip';

const SERIES = [
  { key: 'crashed', label: 'Crashed', color: 'var(--sev-error)' },
  { key: 'healthy', label: 'Healthy', color: 'var(--chart-3)' },
] as const;

interface ChartPoint {
  t: number;
  total: number;
  crashed: number;
  healthy: number;
}

function ChartTooltip(props: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  const { active, payload } = props;
  if (!active || !payload?.length) {
    return null;
  }
  const point = payload[0].payload;

  return (
    <ChartTooltipSurface>
      <ChartTooltipRow label="Sessions" value={exactCount(point.total)} />
      {SERIES.map((series) => (
        <ChartTooltipRow
          key={series.key}
          color={series.color}
          label={series.label}
          value={exactCount(point[series.key])}
        />
      ))}
      <ChartTooltipCaption>
        {format(new Date(point.t), 'PPp')}
      </ChartTooltipCaption>
    </ChartTooltipSurface>
  );
}

interface SessionHealthAreaProps {
  data: SessionTimeseries;
  height?: number;
}

/**
 * Session volume over time, split into crashed and healthy.
 *
 * Shows what the crash-free percentage hides: a 99% rate on ten sessions and
 * on ten thousand are very different situations, and only the stacked volume
 * distinguishes them. Crashed sits on the baseline so its magnitude reads
 * directly off the axis.
 */
export function SessionHealthArea({
  data,
  height = 180,
}: SessionHealthAreaProps) {
  const chartData: ChartPoint[] = data.map((point) => ({
    t: new Date(point.bucket).getTime(),
    total: point.total,
    crashed: point.crashed,
    healthy: Math.max(0, point.total - point.crashed),
  }));

  if (chartData.length === 0 || chartData.every((p) => p.total === 0)) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No session data for this period
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* debounce: see ErrorVolumeChart — the sidebar transition emits a
          continuous stream of resize observations. */}
      <ResponsiveContainer width="100%" height={height} debounce={80}>
        <AreaChart
          data={chartData}
          margin={{ top: 6, right: 4, bottom: 0, left: 0 }}
        >
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v) => format(new Date(v), 'MMM d')}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            minTickGap={48}
          />
          <YAxis
            tickFormatter={compactCount}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            width={40}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
            content={<ChartTooltip />}
          />
          {SERIES.map((series) => (
            <Area
              key={series.key}
              dataKey={series.key}
              stackId="sessions"
              stroke={series.color}
              strokeWidth={2}
              // A wash, never a saturated block: the stroke carries identity.
              fill={series.color}
              fillOpacity={0.1}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      <ChartLegend items={SERIES.map((s) => ({ ...s }))} />
    </div>
  );
}
