// Not loaded through next/dynamic, deliberately: this package has no
// framework opinion, and recharts is already the only thing that pulls
// these primitives in -- deferring the import buys nothing a consumer's own
// code-splitting doesn't already give it.
// react-doctor-disable-next-line react-doctor/prefer-dynamic-import
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '../../lib/cn';
import { ChartLegend, ChartTooltip, XTick, YTick } from './chart-parts';
import { type ChartSeries, seriesColor } from './chart-series';

/**
 * Bucketed bars over time: the events-by-severity chart, a log volume.
 *
 * Stacked by default, because that is what the product asks of it -- one
 * column per bucket, severity as bands. The bands separate with a 1 px
 * stroke of the surface, not a lighter shade: a real gap survives every
 * kind of colour-blindness, which is what lets error sit next to warning.
 * Only the top of the column is rounded; data grows from the baseline and
 * the baseline stays sharp.
 *
 * When the series are severities, pass their colours (`var(--sev-error)`…):
 * status colours are reserved and never come from the categorical order.
 */
export interface BarsChartProps<TDatum extends Record<string, unknown>> {
  data: TDatum[];
  series: ChartSeries[];
  xKey: string;
  height: number;
  /**
   * Take the parent's height instead, with `height` as the floor.
   *
   * A card in a grid row is as tall as the tallest card beside it, and a chart
   * with a pixel height leaves the difference as dead space at the bottom of
   * its own card. Recharts needs a number to draw into, so this hands it a
   * flex box to measure rather than a figure.
   */
  fill?: boolean;
  /**
   * How many ticks to skip on the X axis.
   *
   * The default thins them, which is what a hundred time buckets need and what
   * a handful of named categories must not have: five releases with two labels
   * under them is a chart nobody can read. Pass `0` to draw every one.
   */
  xInterval?: number | 'preserveStartEnd';
  stacked?: boolean;
  formatX?: (value: string | number) => string;
  formatY?: (value: number) => string;
  /** Pin the Y scale: `[0, 100]` for a share. Absent, it follows the data. */
  yDomain?: [number, number];
  /**
   * How much room the Y labels get, in pixels.
   *
   * 40 fits four digits, which is what a count needs. A percentage does not:
   * `99,5 %` is six characters and comes back clipped to `5,0 %`, which is not
   * a smaller number, it is a different one.
   */
  yAxisWidth?: number;
  /** Names the figure for screen readers; the drawing stays explorable. */
  label: string;
  className?: string;
}

export function BarsChart<TDatum extends Record<string, unknown>>({
  data,
  series,
  xKey,
  height,
  fill,
  xInterval = 'preserveStartEnd',
  stacked = true,
  formatX,
  formatY,
  yDomain,
  yAxisWidth = 40,
  label,
  className,
}: BarsChartProps<TDatum>) {
  return (
    <figure
      aria-label={label}
      className={cn(fill && 'flex min-h-0 flex-1 flex-col', className)}
    >
      <div className={fill ? 'min-h-0 flex-1' : undefined}>
        <ResponsiveContainer
          height={fill ? '100%' : height}
          minHeight={fill ? height : undefined}
          width="100%"
        >
          <BarChart
            data={data}
            margin={{ top: 4, right: 20, bottom: 0, left: 0 }}
            barCategoryGap="24%"
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--border-divider)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey={xKey}
              axisLine={false}
              tickLine={false}
              tick={<XTick format={formatX} />}
              interval={xInterval}
              minTickGap={32}
            />
            <YAxis
              width={yAxisWidth}
              axisLine={false}
              tickLine={false}
              tick={
                <YTick
                  format={
                    formatY ? (value) => formatY(Number(value)) : undefined
                  }
                />
              }
              tickCount={4}
              domain={yDomain}
            />
            <Tooltip
              cursor={{ fill: 'var(--surface-hover)' }}
              isAnimationActive={false}
              content={
                <ChartTooltip
                  series={series}
                  formatLabel={formatX}
                  formatValue={formatY}
                />
              }
            />

            {series.map((entry, index) => {
              const top = index === series.length - 1;
              return (
                <Bar
                  key={entry.key}
                  dataKey={entry.key}
                  stackId={stacked ? 'stack' : undefined}
                  fill={seriesColor(entry, index)}
                  // The 1 px surface seam between stacked bands.
                  stroke="var(--surface)"
                  strokeWidth={1}
                  radius={top || !stacked ? [2, 2, 0, 0] : 0}
                  // See TimeSeriesChart: entry animation explains nothing.
                  isAnimationActive={false}
                />
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ChartLegend series={series} />
    </figure>
  );
}

BarsChart.displayName = 'BarsChart';
