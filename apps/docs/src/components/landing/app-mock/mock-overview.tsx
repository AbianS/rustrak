'use client';

import { ArrowUpRight, Users } from 'lucide-react';
import type { MotionValue } from 'motion/react';
import { cn } from '@/lib/utils';
import { useCompact } from './app-frame';
import {
  CrashFreeTrend,
  compact,
  ErrorVolumeChart,
  SessionHealthArea,
  TransactionP95Bars,
  TrendSparkline,
} from './charts';
import { ISSUES, SESSIONS, TRANSACTIONS, VOLUME } from './fixtures';
import { MockCard, MockLevel, MockShell, usePad } from './mock-shell';
import { Enter, MockStage, Settle, type StageMode, Ticker } from './stage';

/**
 * The project overview, recreated from
 * apps/webview-ui/src/app/(main)/projects/[id]/page.tsx.
 *
 * Tile *area* is the hierarchy, which is the whole idea of the real bento: the
 * error-volume chart is the one thing worth looking at first, so it takes four
 * times the area of a counter tile and everything else orbits it. The tile set,
 * their spans and their labels are the app's, down to the subtitles that admit
 * which tiles ignore the period filter.
 */

/** `ProjectHeader` — the band every project route opens with. */
function ProjectHeaderBand() {
  return (
    <div
      className={cn(
        'flex shrink-0 items-start justify-between gap-4 border-b border-border py-6',
        usePad(),
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-extrabold tracking-tight">
          checkout-api
        </h1>
        <p className="mt-1 truncate font-mono text-sm text-muted-foreground">
          checkout-api
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Events
        </p>
        {/* The project's lifetime digested-event count, which is the one
            figure on this page that is genuinely never still. It keeps
            accruing while the screen is idle rather than freezing at a
            plausible-looking total. */}
        <p className="text-xl font-bold text-primary">
          <Ticker value={4812004} delay={0.3} live={3.2} />
        </p>
      </div>
    </div>
  );
}

/** `OverviewPeriodFilter` — the window selector, held in the URL. */
function PeriodFilter() {
  const periods = ['24h', '7d', '14d', '30d', 'All'];
  return (
    <div className="flex w-fit items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
      {periods.map((period) => (
        <span
          key={period}
          className={cn(
            'flex h-7 items-center rounded-md px-3 text-sm font-medium',
            period === '24h'
              ? 'bg-secondary text-secondary-foreground shadow-xs'
              : 'text-muted-foreground',
          )}
        >
          {period}
        </span>
      ))}
    </div>
  );
}

/**
 * `StatTile` — a headline number with its period-over-period change.
 *
 * `polarity` is why the arrow can be red while pointing up: on this dashboard
 * more events is worse, so the tone is derived from the direction *and* what
 * the metric means, never from the sign alone.
 */
function StatTile({
  label,
  value,
  change,
  footnote,
  delay,
}: {
  label: string;
  value: number;
  change: string;
  footnote?: string;
  delay: number;
}) {
  return (
    <MockCard title={label} className="justify-between">
      <div className="flex flex-col gap-1.5">
        {/* Proportional figures, not tabular: at this size tabular digits give
            every glyph the width of a zero and the number reads loose. */}
        <p className="text-3xl font-bold leading-none">
          <Ticker value={value} format={compact} delay={delay} />
        </p>
        <span className="flex items-center gap-0.5 text-xs font-medium tabular-nums text-red-400">
          <ArrowUpRight className="size-3.5" />
          {change}
          <span className="font-normal text-muted-foreground">vs prev</span>
        </span>
        {footnote ? (
          <span className="text-xs text-muted-foreground">{footnote}</span>
        ) : null}
      </div>
    </MockCard>
  );
}

export function MockOverview({
  mode,
  armed,
  enterDelay,
  gate,
}: {
  mode?: StageMode;
  /** Gates `mode="enter"`; ignored while scrubbing. */
  armed?: boolean;
  /** Holds the fill-in until the panel around it is actually visible. */
  enterDelay?: number;
  /** Off-centre signal, for a caller that pins this screen. Idle gating only. */
  gate?: MotionValue<number>;
}) {
  // The bento is the one place the narrow design changes the *structure* of a
  // screen rather than its measurements: four columns at 560px would put a
  // `text-3xl` counter in a 120px box. Halved, every tile keeps the width it
  // was drawn for and the page simply runs longer — which is what the real
  // dashboard does at this width too.
  // Named `narrow` rather than `compact`: `compact` is already the number
  // formatter this screen puts through every counter on it.
  const narrow = useCompact();
  const full = narrow ? 'col-span-2' : 'col-span-4';
  const wide = narrow ? 'col-span-2' : 'col-span-3';

  return (
    <MockStage mode={mode} armed={armed} delay={enterDelay} gate={gate}>
      <MockShell active="Overview">
        <ProjectHeaderBand />

        {/*
          The real page scrolls, and at this viewport the bento is taller than
          the fold — so the bottom row is masked out rather than sliced off at
          the frame edge. A hard cut reads as a broken card; a fade reads as
          what it is, a page that continues.
        */}
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col gap-4 overflow-hidden py-6',
            usePad(),
          )}
          style={{
            maskImage:
              'linear-gradient(to bottom, black calc(100% - 72px), transparent)',
          }}
        >
          <PeriodFilter />

          <div
            className={cn('grid gap-4', narrow ? 'grid-cols-2' : 'grid-cols-4')}
          >
            <Settle index={0} className="col-span-2 min-w-0">
              <MockCard title="Error volume by severity" className="h-full">
                <ErrorVolumeChart data={VOLUME} height={200} />
              </MockCard>
            </Settle>

            <div className="col-span-2 grid min-w-0 grid-cols-2 gap-4">
              <Settle index={1}>
                <StatTile
                  label="Events"
                  value={48204}
                  change="+12.4%"
                  delay={0.4}
                />
              </Settle>
              <Settle index={2}>
                <StatTile
                  label="New issues"
                  value={6}
                  change="+50.0%"
                  footnote="37 open"
                  delay={0.5}
                />
              </Settle>
              <Settle index={3} className="col-span-2 min-w-0">
                <MockCard title="Crash-free sessions">
                  <CrashFreeTrend data={SESSIONS} />
                </MockCard>
              </Settle>
            </div>

            <Settle index={4} className={cn(wide, 'min-w-0')}>
              <MockCard
                title="Session health"
                subtitle="Healthy and crashed sessions over time"
                className="h-full"
              >
                <SessionHealthArea data={SESSIONS} height={140} />
              </MockCard>
            </Settle>

            <Settle index={5} className={cn(narrow && full, 'min-w-0')}>
              <MockCard
                title="Latency"
                subtitle="Slowest transactions by p95, all time"
                className="h-full"
              >
                <TransactionP95Bars rows={TRANSACTIONS.slice(0, 4)} />
              </MockCard>
            </Settle>

            <Settle index={6} className={cn(full, 'min-w-0')}>
              <MockCard
                title="Top issues"
                subtitle="Open issues by total events, all time"
              >
                {/* `IssueListCard`: title, level, short id, trend, users, count.
                    That ordering is the argument — a bare event count is noise,
                    "how many people, and is it accelerating" is a signal. */}
                <div className="flex flex-col divide-y divide-border">
                  {ISSUES.slice(0, 4).map((issue, index) => (
                    <Enter
                      key={issue.shortId}
                      index={index}
                      delay={0.44}
                      className="flex items-center gap-3 py-2.5 first:pt-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {issue.title}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <MockLevel level={issue.level} />
                          <span className="font-mono text-muted-foreground/70">
                            {issue.shortId}
                          </span>
                        </div>
                      </div>

                      <TrendSparkline
                        trend={issue.trend}
                        delay={0.5 + index * 0.04}
                        live={issue.substatus === 'Escalating'}
                      />

                      <span className="flex shrink-0 items-center gap-1 font-mono text-xs text-muted-foreground">
                        <Users className="size-3.5" />
                        {compact(issue.users)}
                      </span>
                      <span className="w-12 shrink-0 text-right font-mono text-sm text-muted-foreground">
                        {compact(issue.events)}
                      </span>
                    </Enter>
                  ))}
                </div>
              </MockCard>
            </Settle>
          </div>
        </div>
      </MockShell>
    </MockStage>
  );
}
