'use client';

import type { AgentTimeseriesPoint } from '@rustrak/client';
import { format } from 'date-fns';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

interface AgentTimeseriesChartProps {
  points: AgentTimeseriesPoint[];
  /** Formats the tooltip value, e.g. as a dollar amount for the cost chart. */
  formatValue?: (value: number) => string;
  height?: number;
}

function ChartTooltip({
  active,
  payload,
  formatValue,
}: {
  active?: boolean;
  payload?: Array<{ payload: { t: number; value: number } }>;
  formatValue: (value: number) => string;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const point = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">
        {formatValue(point.value)}
      </p>
      <p className="text-muted-foreground">
        {format(new Date(point.t), 'PP p')}
      </p>
    </div>
  );
}

const defaultFormatValue = (value: number) => value.toLocaleString();

/**
 * A time-bucketed bar chart — Agent Runs / Estimated Cost widgets. Mirrors
 * `EventChart`'s styling exactly (hidden axis lines, CSS-var colors, no
 * animation) so it matches the rest of the dashboard's chart language.
 */
export function AgentTimeseriesChart({
  points,
  formatValue = defaultFormatValue,
  height = 130,
}: AgentTimeseriesChartProps) {
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
        No data yet
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
          content={<ChartTooltip formatValue={formatValue} />}
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
