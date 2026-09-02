// Not loaded through next/dynamic, deliberately: this package has no
// framework opinion, and recharts is already the only thing that pulls
// these primitives in -- deferring the import buys nothing a consumer's own
// code-splitting doesn't already give it.
// react-doctor-disable-next-line react-doctor/prefer-dynamic-import
import {
  CartesianGrid,
  ScatterChart as RechartsScatter,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { cn } from '../../lib/cn';
import { tv, type VariantProps } from '../../lib/tv';
import { XTick, YTick } from './chart-parts';

/**
 * Two measurements against each other, one dot per thing.
 *
 * This is the chart for the question a ranked list cannot answer: *which of
 * these matters*. A list of the five slowest endpoints puts a batch job nobody
 * waits on at the top and buries the checkout call underneath it. Plotted
 * against how often each one is called, the same five rows separate into
 * corners, and the top right is the work.
 *
 * It is deliberately small in what it accepts. A general scatter takes an
 * arbitrary datum and a pair of accessors; this one takes points that already
 * know their own name, because the name is what the tooltip is for and a
 * nameless dot is not worth drawing.
 */
const scatter = tv({
  base: '',
  variants: {
    tone: {
      neutral: 'fill-chart-1',
      brand: 'fill-surface-brand',
      warning: 'fill-sev-warning',
      danger: 'fill-sev-error',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type ScatterTone = NonNullable<VariantProps<typeof scatter>['tone']>;

export interface ScatterPoint {
  /** Stable: React's key and the point's identity. */
  id: string;
  /** What the dot is. The tooltip says it; nothing else does. */
  name: string;
  x: number;
  y: number;
  tone?: ScatterTone;
}

export interface ScatterChartProps {
  points: ScatterPoint[];
  /** Fixed height in pixels; the width follows the container. */
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
  /** What the axes measure, said on the axis itself. */
  xCaption: string;
  yCaption: string;
  formatX?: (value: number) => string;
  formatY?: (value: number) => string;
  /** Names the figure for screen readers; the drawing stays explorable. */
  label: string;
  className?: string;
}

const TONES: ScatterTone[] = ['neutral', 'brand', 'warning', 'danger'];

interface ScatterTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: ScatterPoint }>;
  xCaption: string;
  yCaption: string;
  formatX?: (value: number) => string;
  formatY?: (value: number) => string;
}

/**
 * A scatter's tooltip names the point first.
 *
 * The shared `ChartTooltip` reads a payload as one row per series, which is
 * right for a stack and wrong here: every dot is its own thing and the two
 * numbers only mean something once you know which endpoint they belong to.
 */
function ScatterTooltip({
  active,
  payload,
  xCaption,
  yCaption,
  formatX,
  formatY,
}: ScatterTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div
      className="min-w-40 rounded-lg border border-border-tooltip bg-surface-tooltip px-2.5 py-2 shadow-tooltip"
      role="status"
    >
      <div className="mb-1 truncate text-control text-fg-on-tooltip">
        {point.name}
      </div>
      {[
        [yCaption, formatY ? formatY(point.y) : point.y],
        [xCaption, formatX ? formatX(point.x) : point.x],
      ].map(([caption, value]) => (
        <div
          key={caption}
          className="flex items-baseline justify-between gap-4 font-mono text-mono-sm tabular-nums"
        >
          <span className="text-fg-meta">{caption}</span>
          <span className="text-fg-on-tooltip">{value}</span>
        </div>
      ))}
    </div>
  );
}

export function ScatterChart({
  points,
  height,
  fill,
  xCaption,
  yCaption,
  formatX,
  formatY,
  label,
  className,
}: ScatterChartProps) {
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
          {/* Room at the foot and the start for the two captions, which sit
            outside the plot rather than inside it: an axis caption printed
            over the data is the first thing to collide with a point. */}
          <RechartsScatter margin={{ top: 8, right: 32, bottom: 22, left: 8 }}>
            <CartesianGrid
              stroke="var(--border-divider)"
              strokeDasharray="3 3"
            />

            <XAxis
              axisLine={false}
              dataKey="x"
              /* Both scales start at nought, which is what a reader assumes of
               an axis of counts and of durations. Starting at the data instead
               fills the plot, and that is exactly the problem: it turns a five
               per cent spread into the full width of the card. */
              domain={[0, 'dataMax']}
              interval="preserveStartEnd"
              // Without a floor the axis packs ticks to the pixel and `1,4 mil`
              // lands on top of `1,7 mil` the first time the card is a phone.
              minTickGap={44}
              label={{
                value: xCaption,
                position: 'insideBottom',
                offset: -16,
                className: 'fill-fg-meta font-mono text-column uppercase',
              }}
              tick={
                <XTick
                  format={(value) =>
                    formatX ? formatX(Number(value)) : String(value)
                  }
                />
              }
              tickLine={false}
              type="number"
            />

            <YAxis
              axisLine={false}
              dataKey="y"
              domain={[0, 'dataMax']}
              label={{
                value: yCaption,
                angle: -90,
                position: 'insideLeft',
                className: 'fill-fg-meta font-mono text-column uppercase',
              }}
              tick={
                <YTick
                  format={(value) =>
                    formatY ? formatY(Number(value)) : String(value)
                  }
                />
              }
              tickCount={4}
              tickLine={false}
              type="number"
              width={56}
            />

            {/* A fixed dot size. Encoding a third measurement in the area is the
              classic bubble chart and it is a classic mistake: nobody reads
              area accurately, and here the two axes already carry everything
              worth reading. */}
            <ZAxis range={[70, 70]} />

            <Tooltip
              content={
                <ScatterTooltip
                  formatX={formatX}
                  formatY={formatY}
                  xCaption={xCaption}
                  yCaption={yCaption}
                />
              }
              cursor={{
                stroke: 'var(--border-strong)',
                strokeDasharray: '3 3',
              }}
              isAnimationActive={false}
            />

            {/* One `Scatter` per tone: recharts fills a series, not a point, so
              a single series would paint every dot the same colour. */}
            {TONES.map((tone) => {
              const group = points.filter(
                (point) => (point.tone ?? 'neutral') === tone,
              );
              if (group.length === 0) return null;

              return (
                <Scatter
                  key={tone}
                  className={scatter({ tone })}
                  data={group}
                  // See TimeSeriesChart: entry animation explains nothing.
                  isAnimationActive={false}
                  stroke="var(--surface)"
                  strokeWidth={1.5}
                />
              );
            })}
          </RechartsScatter>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

ScatterChart.displayName = 'ScatterChart';
