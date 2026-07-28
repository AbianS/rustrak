'use client';

import type { GenAiBreakdownRow } from '@rustrak/client';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface AgentBreakdownChartProps {
  rows: GenAiBreakdownRow[];
  formatValue?: (value: number) => string;
  height?: number;
}

const defaultFormatValue = (value: number) => value.toLocaleString();

function ChartTooltip({
  active,
  payload,
  formatValue,
}: {
  active?: boolean;
  payload?: Array<{ payload: { label: string; value: number } }>;
  formatValue: (value: number) => string;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const point = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">{point.label}</p>
      <p className="text-muted-foreground">{formatValue(point.value)}</p>
    </div>
  );
}

/**
 * A "top N by X" categorical bar chart — LLM Calls by Model / Tokens Used by
 * Model / Tool Calls by Tool widgets. Horizontal orientation reads better
 * for the typically-long model/tool name labels.
 */
export function AgentBreakdownChart({
  rows,
  formatValue = defaultFormatValue,
  height = 130,
}: AgentBreakdownChartProps) {
  if (rows.length === 0) {
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
        data={rows}
        layout="vertical"
        margin={{ top: 6, right: 12, bottom: 0, left: 0 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={110}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: string) =>
            v.length > 16 ? `${v.slice(0, 15)}…` : v
          }
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
          content={<ChartTooltip formatValue={formatValue} />}
        />
        <Bar
          dataKey="value"
          fill="var(--chart-1)"
          radius={[0, 2, 2, 0]}
          maxBarSize={18}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
