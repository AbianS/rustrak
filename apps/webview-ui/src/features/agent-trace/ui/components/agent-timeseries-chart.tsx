'use client';

import type { AgentTimeseriesPoint } from '@rustrak/client';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
// Not loaded through next/dynamic, deliberately.
//
// The advice does not apply in the App Router: this module is a client
// boundary, so recharts is already its own chunk and only ships to the three
// routes that draw charts. dynamic() would not remove it from those, only
// defer it past hydration — and on the overview and the agents page the
// charts are the content, so deferring them puts a hole where the number
// goes. It also cannot be written here: these are five named primitives used
// as JSX, and every consumer is a Server Component, where ssr: false throws.
// react-doctor-disable-next-line react-doctor/prefer-dynamic-import
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

interface AgentTimeseriesChartProps {
  points: AgentTimeseriesPoint[];
  height?: number;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { t: number; value: number } }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const point = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">
        {point.value.toLocaleString()}
      </p>
      <p className="text-muted-foreground">
        {format(new Date(point.t), 'PP p')}
      </p>
    </div>
  );
}

/**
 * A time-bucketed bar chart — the Agent Runs widget. Mirrors `EventChart`'s
 * styling exactly (hidden axis lines, CSS-var colors, no animation) so it
 * matches the rest of the dashboard's chart language.
 */
export function AgentTimeseriesChart({
  points,
  height = 130,
}: AgentTimeseriesChartProps) {
  const t = useTranslations('agents');
  const chartData = points.map((p) => ({
    t: new Date(p.bucket).getTime(),
    value: p.value,
  }));

  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        {t('charts.noData')}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
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
        <Tooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
          content={<ChartTooltip />}
        />
        <Bar
          dataKey="value"
          fill="var(--primary)"
          radius={[2, 2, 0, 0]}
          maxBarSize={16}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
