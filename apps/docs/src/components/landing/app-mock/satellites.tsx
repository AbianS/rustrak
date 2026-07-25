'use client';

import { ArrowUpRight, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CrashFreeTrend, compact, TrendSparkline } from './charts';
import type { OperationType } from './fixtures';
import { ISSUES, SESSIONS, SPANS } from './fixtures';
import { MockLevel, MockPill } from './mock-shell';
import { Beacon, MockStage, Sweep, Ticker } from './stage';

/**
 * The surfaces that orbit the hero panel.
 *
 * ── They are product, not props ─────────────────────────────────────────────
 *
 * These used to be a Slack post, a terminal and a cut-down trace, each inside a
 * fake window with a traffic-light dot on it. Two of the three were not the
 * product at all — they were pictures of *other* software reacting to it — and
 * the window chrome was a third invention on top, a kind of frame that appears
 * nowhere in Rustrak.
 *
 * That is a weak first impression for a specific reason: the hero's job is to
 * show what you get, and a terminal printing `envelope accepted` shows what you
 * type. So all three are now real surfaces lifted out of the app at readable
 * size — an issue row, a release's session health, one agent trace — wearing
 * the app's own card chrome, its own severity palette and its own components
 * (`MockLevel`, `MockPill`, `TrendSparkline`, `CrashFreeTrend`).
 *
 * The composition reads the same, and now every part of it is a claim that can
 * be checked against the running product.
 *
 * ── They are alive ──────────────────────────────────────────────────────────
 *
 * Each animates on the same terms as the panel behind it: counters accrue
 * rather than loop, bars sweep out in the order the spans ran, the token beacon
 * keeps breathing. Nothing here moves only to move, and all of it is gated on
 * the composition being assembled and still on screen (`IdleProvider` in
 * `sections/hero.tsx`), so none of it costs a frame once the hero is past.
 */

/**
 * The app's card, as the satellites need it: one step off the page, with a
 * shadow deep enough to sit over a painting.
 *
 * Deliberately not a window. A card is what the product actually draws, so
 * lifting one out and enlarging it is a quotation; wrapping it in invented
 * chrome would make it an illustration of a quotation.
 */
function Surface({
  label,
  meta,
  children,
}: {
  label: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[var(--card)] shadow-[0_34px_80px_-20px_rgba(0,0,0,0.95)]">
      <div className="flex items-center gap-2 border-b border-white/8 px-3.5 py-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">
          {label}
        </span>
        {meta ? <span className="ml-auto">{meta}</span> : null}
      </div>
      {children}
    </div>
  );
}

/**
 * Top left, behind the panel: one row of the issue stream.
 *
 * The row is reproduced whole rather than simplified — title, culprit, the
 * quiet indicator strip, then the counts and the trend — because its restraint
 * is the argument. One cause carries a couple of muted attributes and a number;
 * only severity earns colour. A satellite that dropped the strip to fit would
 * be advertising a louder product than the one that ships.
 */
export function IssueCard() {
  const issue = ISSUES[0];

  return (
    <MockStage>
      <Surface
        label="Issue"
        meta={
          <span className="font-mono text-[10px] text-white/30">
            {issue.shortId}
          </span>
        }
      >
        <div className="px-3.5 py-3">
          <p className="text-[12.5px] font-semibold leading-snug text-white/90">
            {issue.title}
          </p>
          <p className="mt-1 truncate font-mono text-[10px] text-white/35">
            {issue.culprit}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <MockPill dot="bg-muted-foreground" label={issue.substatus} />
            <MockLevel level={issue.level} />
          </div>

          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-widest text-white/30">
                Events
              </p>
              {/* Accrues rather than loops: the figure is a lifetime total, so
                  the only honest way to keep it moving is upward. */}
              <Ticker
                value={issue.events}
                format={compact}
                delay={0.35}
                live={4}
                className="mt-0.5 block font-mono text-[19px] leading-none text-white"
              />
            </div>
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-widest text-white/30">
                Users
              </p>
              <span className="mt-0.5 inline-flex items-center gap-1 font-mono text-[19px] leading-none text-white">
                <Users className="size-3.5 text-white/40" />
                <Ticker value={issue.users} format={compact} delay={0.45} />
              </span>
            </div>
            <TrendSparkline
              trend={issue.trend}
              delay={0.5}
              live
              className="h-7 w-16 shrink-0"
              barClassName="fill-[color:var(--sev-error)]/70"
            />
          </div>
        </div>
      </Surface>
    </MockStage>
  );
}

/**
 * Bottom left, in front of the panel: crash-free sessions for a release.
 *
 * This is the one satellite that overlaps the screen behind it, so it is the
 * one that has to land at a glance — a single large figure with its trend under
 * it, rather than anything that needs reading. It also carries the half of the
 * story the other two do not: the same SDK envelopes that produce errors
 * produce session health, so nothing here costs a second integration.
 */
export function SessionCard() {
  const latest = SESSIONS[SESSIONS.length - 1];
  const rate = ((latest.total - latest.crashed) / latest.total) * 100;

  return (
    <MockStage>
      <Surface
        label="Crash-free sessions"
        meta={
          <span className="font-mono text-[10px] text-white/30">v2.14.0</span>
        }
      >
        <div className="px-3.5 py-3">
          <div className="flex items-baseline gap-1.5">
            <Ticker
              value={rate}
              format={(n) => n.toFixed(2)}
              delay={0.4}
              className="font-mono text-[26px] leading-none text-white"
            />
            <span className="font-mono text-[13px] text-white/40">%</span>
            <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-primary">
              <ArrowUpRight className="size-3" />
              0.31
            </span>
          </div>

          {/* The app's own chart, at the app's own proportions. */}
          <div className="-ml-2 mt-3">
            <CrashFreeTrend data={SESSIONS} width={250} height={92} />
          </div>
        </div>
      </Surface>
    </MockStage>
  );
}

/** Matches `OPERATION_TYPE_COLOR` in the real agent waterfall. */
const OPERATION_COLOR: Record<OperationType, string> = {
  agent: 'bg-violet-500',
  tool: 'bg-amber-500',
  ai_client: 'bg-emerald-500',
  handoff: 'bg-cyan-500',
};

const TRACE_MS = 8420;

/**
 * Right, behind the panel: one agent run resolved into spans.
 *
 * Cut down from the real waterfall to what survives at this size — the
 * operation chip colour, the offset bar and the duration — because those three
 * are what make it a trace rather than a list. The colour is
 * `gen_ai.operation.type`, as in the product: a waterfall painted in one brand
 * colour would be a pretty chart that answers nothing.
 *
 * The bars sweep from their own start, delayed by where the span begins, so the
 * run replays in the order it happened.
 */
export function TraceCard() {
  return (
    <MockStage>
      <Surface
        label="Agent trace"
        meta={
          <span className="font-mono text-[10px] text-white/55">8.42s</span>
        }
      >
        <div className="px-3.5 py-3">
          <p className="truncate font-mono text-[10px] text-white/40">
            support-triage-agent
          </p>

          <div className="mt-3 space-y-2">
            {SPANS.slice(1).map((span) => (
              <div key={span.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className={cn(
                        'size-1.5 shrink-0 rounded-[2px]',
                        OPERATION_COLOR[span.operation],
                      )}
                    />
                    <span className="truncate font-mono text-[9.5px] text-white/55">
                      {span.label}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-white/30">
                    {(span.durationMs / 1000).toFixed(2)}s
                  </span>
                </div>
                <div className="relative mt-1 h-1 rounded-full bg-white/6">
                  <Sweep
                    delay={0.08 + (span.startMs / TRACE_MS) * 0.45}
                    className={cn(
                      'absolute inset-y-0 rounded-full opacity-80',
                      OPERATION_COLOR[span.operation],
                    )}
                    style={{
                      left: `${(span.startMs / TRACE_MS) * 100}%`,
                      width: `${(span.durationMs / TRACE_MS) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex justify-between border-t border-white/8 pt-2.5 font-mono text-[9.5px] text-white/35">
            <span className="flex items-center gap-1.5">
              <Beacon className="bg-primary" />
              42k tokens
            </span>
            <span>{SPANS.length} spans</span>
          </div>
        </div>
      </Surface>
    </MockStage>
  );
}
