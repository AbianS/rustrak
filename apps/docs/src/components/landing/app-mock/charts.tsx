'use client';

import { motion, useTransform } from 'motion/react';
import { Fragment } from 'react';
import type { SessionBucket, VolumeBucket } from './fixtures';
import {
  Breath,
  Draw,
  Grow,
  Pulse,
  StepGrow,
  Sweep,
  useSlot,
  Wash,
} from './stage';

/**
 * The overview's charts, recreated.
 *
 * Hand-rolled SVG rather than the app's `recharts`: the landing draws four
 * fixed series and does not need a charting runtime to do it, and the marks are
 * then ours to animate. What is *not* traded away is the chart language — the
 * stack order, the severity palette, the 2px gap between stacked segments, the
 * rounded cap on the top segment only, the dashed mean line, the legend row.
 * Those are the parts a reader would recognise from the product, so they are
 * reproduced from the real components rather than approximated.
 */

/**
 * Built once, at module scope.
 *
 * `new Intl.NumberFormat(...)` is not a cheap constructor — it resolves a
 * locale and builds a formatter — and this used to run on every call. `compact`
 * is a `Ticker` formatter, so "every call" meant several times a frame for as
 * long as a counter was on screen.
 */
const COMPACT = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** `compactCount` from apps/webview-ui/src/lib/chart-format.ts. */
export function compact(value: number): string {
  if (Math.abs(value) < 1000) {
    return String(Math.round(value));
  }
  return COMPACT.format(value);
}

/** `crashFreeColor` from lib/session-health.ts — the rate colours itself. */
export function crashFreeColor(rate: number): string {
  if (rate >= 0.99) return 'var(--chart-3)';
  if (rate >= 0.95) return 'var(--sev-warning)';
  return 'var(--sev-error)';
}

/** `ChartLegend` from components/charts/chart-tooltip.tsx. */
export function ChartLegend({
  items,
}: {
  items: ReadonlyArray<{ label: string; color: string }>;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            aria-hidden
            className="size-2 rounded-[2px]"
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** Axis tick, matching recharts' `fontSize: 11, fill: var(--muted-foreground)`. */
function Tick({
  x,
  y,
  anchor = 'middle',
  children,
}: {
  x: number;
  y: number;
  anchor?: 'start' | 'middle' | 'end';
  children: string;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="middle"
      fontSize={11}
      fill="var(--muted-foreground)"
    >
      {children}
    </text>
  );
}

/* -------------------------------------------------------------------------
   Error volume by severity
   ---------------------------------------------------------------------- */

const VOLUME_SERIES = [
  { key: 'errors', label: 'Errors', color: 'var(--sev-error)' },
  { key: 'warning', label: 'Warnings', color: 'var(--sev-warning)' },
  { key: 'info', label: 'Info', color: 'var(--sev-info)' },
] as const;

/** 2px of surface between touching segments, per the app's chart mark spec. */
const SEGMENT_GAP = 2;
const CAP_RADIUS = 4;

/** Rect with the two top corners rounded and the baseline square. */
function roundedTop(
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): string {
  const r = Math.min(radius, w / 2, h);
  if (r <= 0) {
    return `M${x},${y}h${w}v${h}h${-w}Z`;
  }
  return [
    `M${x},${y + h}`,
    `V${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    `H${x + w - r}`,
    `A${r},${r} 0 0 1 ${x + w},${y + r}`,
    `V${y + h}`,
    'Z',
  ].join('');
}

/**
 * `ErrorVolumeChart` — the lead tile of the project overview.
 *
 * Errors sit on the baseline so the segment that matters most reads straight
 * off the y-axis, fatal is folded into them, and the dashed line is the mean:
 * it answers "is this bucket unusual?" without a second axis.
 *
 * The bars grow from the baseline in time order, which is not decoration —
 * left-to-right on a time axis is the buckets filling as the day happened.
 */
/**
 * How much the current bucket grows per event that lands on it, and the ceiling
 * it may not pass.
 *
 * The cap is not tuning, it is honesty: the loop runs for as long as the hero is
 * on screen, and an uncapped step would eventually push the bar through the top
 * of its own plot and past the mean line that is supposed to measure it. Six
 * arrivals of visible growth is more than any reader watches.
 */
const STEP_PER_EVENT = 0.05;
const STEP_CEILING = 0.3;

export function ErrorVolumeChart({
  data,
  boost = 0,
  width = 452,
  height = 208,
}: {
  data: VolumeBucket[];
  /**
   * Events that have landed on the current bucket since the screen settled.
   *
   * The hero supplies it from its scene. Elsewhere it is zero, and the chart is
   * the static series it has always been.
   */
  boost?: number;
  width?: number;
  height?: number;
}) {
  const gutter = 44;
  const plotW = width - gutter;
  const plotH = height - 22;

  const totals = data.map((d) => d.errors + d.fatal + d.warning + d.info);
  const max = Math.max(...totals);
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;

  // recharts picks "nice" ticks; four evenly spaced ones over the domain is
  // what a 24-bucket window lands on in the real tile.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const slot = plotW / data.length;
  const barW = Math.min(24, slot * 0.68);
  const scale = (v: number) => (v / max) * plotH;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Error volume by severity over the last 24 hours"
      >
        {ticks.map((t) => (
          <Tick key={t} x={gutter - 8} y={plotH - scale(t)} anchor="end">
            {compact(t)}
          </Tick>
        ))}

        {data.map((bucket, index) => {
          const x = gutter + index * slot + (slot - barW) / 2;
          const stack = [
            { key: 'errors', v: bucket.errors + bucket.fatal },
            { key: 'warning', v: bucket.warning },
            { key: 'info', v: bucket.info },
          ];
          const topMost = [...stack].reverse().find((s) => s.v > 0)?.key;

          let cursor = plotH;
          // Only the newest bucket breathes, because only its value is still
          // moving: that bar covers the hour we are in.
          const current = index === data.length - 1;
          const bars = (
            <>
              {stack.map((segment) => {
                if (segment.v <= 0) return null;
                const h = scale(segment.v);
                const y = cursor - h;
                cursor = y;
                const isTop = topMost === segment.key;
                // Only inset segments that carry something above them, and
                // only when they are tall enough to survive it.
                const inset = !isTop && h > SEGMENT_GAP + 1 ? SEGMENT_GAP : 0;
                const color = VOLUME_SERIES.find(
                  (s) => s.key === segment.key,
                )!.color;

                return (
                  <path
                    key={segment.key}
                    d={roundedTop(
                      x,
                      y + inset,
                      barW,
                      h - inset,
                      isTop ? CAP_RADIUS : 0,
                    )}
                    fill={color}
                  />
                );
              })}
            </>
          );

          return (
            <Grow key={bucket.hoursAgo} index={index} origin={`0 ${plotH}px`}>
              {current ? (
                // Three scales on one baseline: the entrance, the step every
                // arrival adds, and the breath over the top of both. They
                // multiply because they share an origin, which is the whole
                // reason the growth can be layered onto a bar that was already
                // moving instead of replacing what it was doing.
                <StepGrow
                  origin={`0 ${plotH}px`}
                  amount={Math.min(boost * STEP_PER_EVENT, STEP_CEILING)}
                >
                  <Breath origin={`0 ${plotH}px`}>{bars}</Breath>
                </StepGrow>
              ) : (
                bars
              )}
            </Grow>
          );
        })}

        {/* The mean, drawn across once the bars it measures are up. */}
        <MeanLine y={plotH - scale(mean)} x1={gutter} x2={width} delay={0.5} />

        {[0, 8, 16, 23].map((index) => (
          <Tick key={index} x={gutter + index * slot + slot / 2} y={height - 8}>
            {index === 23 ? 'now' : `${23 - index}h ago`}
          </Tick>
        ))}
      </svg>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ChartLegend items={VOLUME_SERIES} />
        <span className="text-xs text-muted-foreground">
          Dashed line: {compact(Math.round(mean))} avg per bucket
        </span>
      </div>
    </div>
  );
}

/** The reference line, drawn across after the bars it is a reference for. */
function MeanLine({
  y,
  x1,
  x2,
  delay,
}: {
  y: number;
  x1: number;
  x2: number;
  delay: number;
}) {
  const p = useSlot(delay, 0.4);
  const opacity = useTransform(p, [0, 0.4], [0, 1]);

  return (
    <motion.g style={{ transformOrigin: `${x1}px ${y}px`, scaleX: p, opacity }}>
      <line
        x1={x1}
        x2={x2}
        y1={y}
        y2={y}
        stroke="var(--muted-foreground)"
        strokeWidth={1}
        strokeDasharray="4 4"
        strokeOpacity={0.6}
      />
    </motion.g>
  );
}

/* -------------------------------------------------------------------------
   Crash-free sessions
   ---------------------------------------------------------------------- */

/** The rate every project is aiming at. Drawn as the line to beat. */
const TARGET = 0.99;
/** Floor of the y-axis unless the data goes lower — see `CrashFreeTrend`. */
const DEFAULT_FLOOR = 0.9;

/**
 * `CrashFreeTrend` — the headline rate next to how it got there.
 *
 * The number alone cannot say whether a project is recovering or falling over,
 * which is the question the overview exists to answer, so the figure and the
 * trend ship together. The line is *traced* rather than faded in: a rate over
 * time is a thing that happened in an order.
 */
export function CrashFreeTrend({
  data,
  width = 300,
  height = 118,
}: {
  data: SessionBucket[];
  width?: number;
  height?: number;
}) {
  const gutter = 40;
  const plotW = width - gutter;
  const plotH = height - 20;

  const rates = data.map((d) => (d.total - d.crashed) / d.total);
  const floor = Math.min(DEFAULT_FLOOR, ...rates);
  const y = (rate: number) => plotH - ((rate - floor) / (1 - floor)) * plotH;
  const x = (index: number) => gutter + (index / (data.length - 1)) * plotW;

  const path = rates
    .map((rate, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(rate)}`)
    .join(' ');

  const overall =
    1 -
    data.reduce((s, d) => s + d.crashed, 0) /
      data.reduce((s, d) => s + d.total, 0);
  const color = crashFreeColor(overall);

  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
      <div className="shrink-0">
        <p className="text-4xl font-bold leading-none" style={{ color }}>
          {(overall * 100).toFixed(1)}%
        </p>
        <dl className="mt-3 space-y-1.5 text-xs">
          <div className="flex items-baseline gap-2">
            <dt className="text-muted-foreground">Users</dt>
            <dd
              className="font-semibold"
              style={{ color: crashFreeColor(0.997) }}
            >
              99.7%
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-muted-foreground">Sessions</dt>
            <dd className="font-semibold tabular-nums">73,986</dd>
          </div>
        </dl>
      </div>

      <div className="min-w-0 flex-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          style={{ height }}
          role="img"
          aria-label="Crash-free session rate over the last 24 hours"
        >
          {[floor, (floor + 1) / 2, 1].map((rate) => (
            <Tick key={rate} x={gutter - 8} y={y(rate)} anchor="end">
              {`${Math.round(rate * 100)}%`}
            </Tick>
          ))}

          {/* The target, so the line is read against something rather than
              against itself. */}
          <line
            x1={gutter}
            x2={width}
            y1={y(TARGET)}
            y2={y(TARGET)}
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            strokeDasharray="4 4"
            strokeOpacity={0.6}
          />
          <text
            x={width - 2}
            y={y(TARGET) - 6}
            textAnchor="end"
            fontSize={10}
            fill="var(--muted-foreground)"
          >
            99%
          </text>

          <Draw
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            delay={0.25}
          />

          {/* The current rate, marked and breathing once the line has finished
              drawing to it. The end of a line has no width to grow, so where a
              bar would fill, this pulses. */}
          <Pulse
            cx={x(rates.length - 1)}
            cy={y(rates[rates.length - 1])}
            color={color}
          />
        </svg>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Session health
   ---------------------------------------------------------------------- */

const SESSION_SERIES = [
  { label: 'Crashed', color: 'var(--sev-error)' },
  { label: 'Healthy', color: 'var(--chart-3)' },
] as const;

/**
 * `SessionHealthArea` — session volume split into crashed and healthy.
 *
 * Shows what the percentage hides: 99% on ten sessions and on ten thousand are
 * very different situations, and only the stacked volume distinguishes them.
 * Crashed sits on the baseline so its magnitude reads off the axis. Fill stays
 * a wash at 10%; the stroke carries the identity.
 */
export function SessionHealthArea({
  data,
  width = 700,
  height = 182,
}: {
  data: SessionBucket[];
  width?: number;
  height?: number;
}) {
  const gutter = 40;
  const plotW = width - gutter;
  const plotH = height - 20;

  const max = Math.max(...data.map((d) => d.total));
  const x = (i: number) => gutter + (i / (data.length - 1)) * plotW;
  const y = (v: number) => plotH - (v / max) * plotH;

  const crashed = data.map((d) => d.crashed);
  const stacked = data.map((d) => d.total);

  const line = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');

  /** The wash between two series: out along the upper edge, back along the lower. */
  const band = (upper: number[], lower: number[]) => {
    const back = lower
      .map((_, i) => lower.length - 1 - i)
      .map((i) => `L${x(i)},${y(lower[i])}`)
      .join(' ');
    return `${line(upper)} ${back} Z`;
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Healthy and crashed sessions over time"
      >
        {[0, 0.5, 1].map((f) => (
          <Tick key={f} x={gutter - 8} y={y(f * max)} anchor="end">
            {compact(f * max)}
          </Tick>
        ))}

        <Wash>
          <path
            d={band(stacked, crashed)}
            fill="var(--chart-3)"
            fillOpacity={0.1}
          />
          <path
            d={`${line(crashed)} L${x(data.length - 1)},${plotH} L${x(0)},${plotH} Z`}
            fill="var(--sev-error)"
            fillOpacity={0.1}
          />
        </Wash>

        <Draw
          d={line(stacked)}
          fill="none"
          stroke="var(--chart-3)"
          strokeWidth={2}
          strokeLinejoin="round"
          delay={0.15}
        />
        <Draw
          d={line(crashed)}
          fill="none"
          stroke="var(--sev-error)"
          strokeWidth={2}
          strokeLinejoin="round"
          delay={0.3}
        />

        {[0, 8, 16, 23].map((i) => (
          <Tick key={i} x={x(i)} y={height - 8}>
            {i === 23 ? 'now' : `${23 - i}h ago`}
          </Tick>
        ))}
      </svg>
      <ChartLegend items={SESSION_SERIES} />
    </div>
  );
}

/* -------------------------------------------------------------------------
   Latency
   ---------------------------------------------------------------------- */

/** A transaction is called out when this share of its requests fail. */
const FAILING_ABOVE = 0.05;

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

/** Drops the HTTP method: it is the least distinguishing part of the name. */
function routeLabel(name: string): string {
  return name.replace(/^[A-Z]+\s+/, '') || name;
}

/**
 * `TransactionP95Bars` — slowest transactions, with the failing ones called out.
 *
 * The label sits above its own full-width bar rather than beside it: in a
 * one-column tile a category axis spends the width on truncated names. Bar
 * length is p95 relative to the slowest in view, so the list reads as "how much
 * worse is the worst". Only the transaction in trouble carries colour, and only
 * it says why.
 */
export function TransactionP95Bars({
  rows,
}: {
  rows: Array<{ name: string; p95Ms: number; failureRate: number }>;
}) {
  const slowest = Math.max(...rows.map((r) => r.p95Ms));

  return (
    <ul className="flex flex-col gap-3.5">
      {rows.map((row, index) => {
        const failing = row.failureRate > FAILING_ABOVE;
        const width = Math.max((row.p95Ms / slowest) * 100, 2);

        return (
          <li key={row.name}>
            <div className="flex items-baseline gap-2">
              <span className="truncate font-mono text-xs font-medium">
                {routeLabel(row.name)}
              </span>
              <span className="ml-auto shrink-0 text-xs font-semibold tabular-nums">
                {formatMs(row.p95Ms)}
              </span>
            </div>

            {/* Square at the baseline, 4px rounded data-end: the error-volume
                mark turned on its side. */}
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-sm bg-muted">
              <Sweep
                delay={0.1 + index * 0.07}
                className="block h-full rounded-r-sm"
                style={{
                  width: `${width}%`,
                  background: failing ? 'var(--sev-error)' : 'var(--sev-info)',
                }}
              />
            </div>

            {failing ? (
              <p className="mt-1 text-[11px] tabular-nums text-[color:var(--sev-error)]">
                {(row.failureRate * 100).toFixed(1)}% failing
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------
   Sparkline and issue chart
   ---------------------------------------------------------------------- */

/**
 * `TrendSparkline` — the trend column of the issue list.
 *
 * Bars, not a line, and scaled against a floor: without one, three events
 * across a quiet day render as a full-height bar that reads exactly like an
 * outage. Sentry hardcodes the same floor with the comment "this keeps small
 * datasets from looking 'scary'".
 *
 * ── Two motion values, not twenty-four ──────────────────────────────────────
 *
 * Every bar used to carry its own `Grow`, staggered by 0.004 of the stage run.
 * That is a `motion.g` with its own scroll-driven `scaleY` per bar, and there
 * are ten of these sparklines on the page between the issue stream and the
 * overview: **two hundred and forty individually transformed SVG groups**, all
 * updating on the same scroll frames.
 *
 * SVG transforms are the wrong place to spend that. Unlike a transform on an
 * HTML element, a transform on an SVG `<g>` is not handed to the compositor —
 * it invalidates and re-rasterises the SVG it lives in. Two hundred and forty
 * of those per frame is what a scroll through the platform chapters was
 * actually paying for.
 *
 * The stagger was also nearly invisible: 24 steps of 0.004 span less than a
 * tenth of the run, so the bars were arriving all but together anyway. What
 * reads is the gesture, so the gesture is what is kept — but as a `clipPath`
 * wipe on the `<svg>` itself, which *is* an accelerable property on a single
 * element. One wipe plus one group scale: two motion values where there were
 * twenty-four, and a truer reading of the same idea, since the day now uncovers
 * left to right instead of every bucket rising at once.
 */
export function TrendSparkline({
  trend,
  minScale = 1,
  className = 'h-6 w-16 shrink-0',
  barClassName = 'fill-muted-foreground/50',
  delay = 0,
  live = false,
}: {
  trend: number[];
  minScale?: number;
  className?: string;
  barClassName?: string;
  delay?: number;
  /** Breathes the newest bucket, for a series that is still accumulating. */
  live?: boolean;
}) {
  const max = Math.max(...trend, minScale);
  const barWidth = 2;
  const gap = 1;

  // The wipe. Trails the rise slightly so bars are already standing when the
  // edge passes them, rather than being revealed flat and growing afterwards.
  const wipe = useSlot(delay + 0.02, 0.42);
  const clipPath = useTransform(
    wipe,
    (p) => `inset(0 ${((1 - p) * 100).toFixed(2)}% 0 0)`,
  );

  const last = trend.length - 1;

  return (
    <motion.svg
      viewBox={`0 0 ${trend.length * (barWidth + gap)} 24`}
      className={className}
      preserveAspectRatio="none"
      role="img"
      aria-label="24h event trend"
      style={{ clipPath }}
    >
      <Grow delay={delay} origin="0 24px">
        {trend.map((count, i) => {
          const height = count > 0 ? Math.max((count / max) * 22, 2) : 0;
          const bar = (
            <rect
              x={i * (barWidth + gap)}
              y={24 - height}
              width={barWidth}
              height={height}
              rx={0.5}
              className={barClassName}
            />
          );

          return live && i === last ? (
            // A fixed authored series, never reordered.
            <Breath key={i} origin="0 24px" amount={0.14}>
              {bar}
            </Breath>
          ) : (
            <Fragment key={i}>{bar}</Fragment>
          );
        })}
      </Grow>
    </motion.svg>
  );
}
