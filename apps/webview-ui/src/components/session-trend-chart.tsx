'use client';

import type { SessionTimeseries } from '@rustrak/client';
import { format } from 'date-fns';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface SessionTrendChartProps {
  data: SessionTimeseries;
  height?: number;
}

interface ChartPoint {
  t: number;
  rate: number | null;
  total: number;
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
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">
        {point.rate === null ? '—' : `${(point.rate * 100).toFixed(1)}%`}{' '}
        crash-free
      </p>
      <p className="text-muted-foreground">
        {point.total.toLocaleString()} session{point.total === 1 ? '' : 's'}
      </p>
      <p className="text-muted-foreground">{format(new Date(point.t), 'PPp')}</p>
    </div>
  );
}

/**
 * Crash-free sessions trend line chart. Built on recharts so it shares the
 * chart language used across the dashboard (see EventChart).
 */
export function SessionTrendChart({ data, height = 180 }: SessionTrendChartProps) {
  const chartData: ChartPoint[] = data.map((point) => ({
    t: new Date(point.bucket).getTime(),
    rate: point.crash_free_sessions_rate,
    total: point.total,
  }));

  if (chartData.length === 0) {
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
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
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
          domain={[0, 1]}
          tickFormatter={(v) => `${Math.round(v * 100)}%`}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
          content={<ChartTooltip />}
        />
        <Line
          dataKey="rate"
          stroke="var(--primary)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
