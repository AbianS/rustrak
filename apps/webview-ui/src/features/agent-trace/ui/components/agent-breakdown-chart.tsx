'use client';

import type { GenAiBreakdownRow } from '@rustrak/client';
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
  const t = useTranslations('agents');

  if (rows.length === 0) {
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
