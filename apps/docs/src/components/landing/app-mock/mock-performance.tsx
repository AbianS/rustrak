'use client';

import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompact } from './design';
import { type MockTxnSpan, TXN_SPANS } from './fixtures';
import { Enter, MockStage, Settle, Sweep } from './stage';

/**
 * The span waterfall, recreated from
 * apps/webview-ui/src/app/(main)/projects/[id]/performance/[txnId]/span-waterfall.tsx.
 *
 * ── Why this screen and not another table ───────────────────────────────────
 *
 * Every other chapter on this page had settled into the same shape: a header, a
 * toolbar, a bordered box, rows. Four of them in sequence, and by the third the
 * reader has learned the shape and stopped looking. That is a bad outcome for a
 * page whose entire job is to show what the product looks like.
 *
 * A waterfall is the one screen in the product that is not a list. It is a
 * picture of time, it is read left to right instead of top to bottom, and its
 * meaning is carried by the *shape* rather than by the text: a reader who has
 * ever opened a slow endpoint sees that one third-party call costs more than
 * everything else on the page before reading a single label. Nothing else in
 * the app communicates that fast.
 *
 * ── Drawn at 1:1 ────────────────────────────────────────────────────────────
 *
 * There is no app shell here, no rail and no page header, and the surface is
 * not scaled. It sits in a `Bleed` (see `primitives/bleed.tsx`) at the app's
 * own pixel sizes and runs off the edges of the band. A waterfall shrunk to
 * 0.65 is a set of coloured smudges; at 1:1 the `903ms` next to the Stripe call
 * is readable, and that number is the entire argument of the section.
 *
 * ── The bars are the entrance ───────────────────────────────────────────────
 *
 * Each bar's `Sweep` is delayed by where its span actually starts in the trace,
 * so scrolling the section replays the request in the order it happened: the
 * order lookup, then the cache miss, then the long wait on Stripe, then the two
 * writes. It is the one entrance on the page that carries information rather
 * than decorating the arrival, which is also why it is not a stagger. A stagger
 * would say "these arrived one after another"; this says *when* each one did.
 */

/**
 * `opColor` from the real component, which prefix-matches so the long tail of
 * op values SDKs emit (`db.sql.query`, `http.client`, `resource.script`) all
 * land somewhere sensible.
 *
 * The app writes these as Tailwind palette classes. They are restated as
 * literal colours here for one reason: this surface sits on the landing's dark
 * band rather than on the app's, and each hue is lifted a step so a 6px bar
 * still reads as blue rather than as dark grey. The assignment is unchanged,
 * because the assignment is what a returning user recognises.
 */
const OP_COLOR: [prefix: string, color: string][] = [
  ['db', 'oklch(0.68 0.17 259.8)'],
  ['http', 'oklch(0.74 0.16 162.5)'],
  ['resource', 'oklch(0.70 0.21 303.9)'],
  ['cache', 'oklch(0.71 0.20 354.3)'],
  ['rpc', 'oklch(0.75 0.14 215.2)'],
  ['grpc', 'oklch(0.75 0.14 215.2)'],
];

function opColor(op: string): string {
  const found = OP_COLOR.find(([prefix]) => op.startsWith(prefix));
  return found ? found[1] : 'var(--primary)';
}

const TOTAL_MS = 1242;

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

/**
 * Share of self-time per operation kind, which is the strip above the rows.
 *
 * Computed rather than authored so it can never disagree with the bars
 * underneath it. A hand-written breakdown that does not add up to the waterfall
 * is the kind of detail nobody notices and everybody feels.
 */
function breakdown(): { op: string; ms: number }[] {
  const totals = new Map<string, number>();
  for (const span of TXN_SPANS) {
    if (span.depth === 0) continue;
    const kind = span.op.split('.')[0];
    const self = span.selfMs ?? span.durationMs;
    totals.set(kind, (totals.get(kind) ?? 0) + self);
  }
  return [...totals.entries()]
    .map(([op, ms]) => ({ op, ms }))
    .sort((a, b) => b.ms - a.ms);
}

function SpanRow({
  span,
  index,
  compact,
}: {
  span: MockTxnSpan;
  index: number;
  compact: boolean;
}) {
  const color = opColor(span.op);
  const failed = span.status !== 'ok';
  // The label column is 38% in the real component, and the bar track takes what
  // is left. Keeping the proportion is what makes a long description truncate
  // in the same place it truncates in the app.
  const offset = (span.startMs / TOTAL_MS) * 100;
  const width = Math.max(0.6, (span.durationMs / TOTAL_MS) * 100);

  return (
    <Enter
      index={index}
      delay={0.2}
      step={0.03}
      className={cn(
        'flex items-center gap-3 rounded-md px-2 py-1',
        // The Stripe call is the row the section is about, so it is the one the
        // app would leave selected. Selection is a tint, not an outline.
        span.id === 't4' && 'bg-muted/50',
      )}
    >
      <div
        className="flex min-w-0 items-center gap-1.5"
        style={{ width: '38%', paddingLeft: span.depth * 12 }}
      >
        {span.depth < 1 || span.id === 't4' ? (
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        ) : (
          <span className="inline-block size-3 shrink-0" />
        )}
        <span
          className="shrink-0 rounded px-1 py-px text-[10px] font-medium text-black"
          style={{ background: color }}
        >
          {span.op}
        </span>
        <span className="truncate text-muted-foreground">
          {span.description}
        </span>
        {failed ? (
          <span className="shrink-0 rounded bg-[var(--sev-error)]/15 px-1 text-[10px] text-[var(--sev-error)]">
            {span.status}
          </span>
        ) : null}
      </div>

      <div className="relative h-4 flex-1">
        {/* The track the bar is measured against. Faint enough to read as a
            guide rather than as an empty bar of its own. */}
        <span className="absolute inset-y-[6px] inset-x-0 rounded-sm bg-foreground/[0.045]" />
        <Sweep
          // Delayed by where the span starts, not by its position in the list.
          delay={0.28 + (span.startMs / TOTAL_MS) * 0.42}
          span={Math.max(0.06, (span.durationMs / TOTAL_MS) * 0.42)}
          className="absolute inset-y-0 block rounded-sm"
          style={{
            left: `${offset}%`,
            width: `${width}%`,
            background: color,
          }}
        />
      </div>

      {compact ? null : (
        <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">
          {formatDuration(span.durationMs)}
        </span>
      )}
    </Enter>
  );
}

export function MockPerformance() {
  const compact = useCompact();
  const parts = breakdown();
  const total = parts.reduce((sum, part) => sum + part.ms, 0);

  return (
    <MockStage>
      <div className="flex h-full flex-col bg-background px-8 py-7 text-foreground">
        <Settle className="shrink-0">
          <p className="font-mono text-[19px] font-semibold">
            POST /v1/payments
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-mono font-semibold">1.24s</span>
            <span className="text-muted-foreground">p95</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="font-mono text-xs text-muted-foreground">
              41,200 events
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="font-mono text-xs text-[var(--sev-error)]">
              8.1% failure rate
            </span>
          </div>
        </Settle>

        <Settle
          delay={0.08}
          className="mt-6 shrink-0 rounded-lg border border-border"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Span waterfall
            </p>
            <span className="text-xs text-muted-foreground">
              {TXN_SPANS.length} spans
            </span>
          </div>

          <div className="space-y-2 p-3">
            {/* Self-time by op. The one place on the screen where the colours
                are explained, which is why it sits above the rows rather than
                in a legend somewhere off to the side. */}
            <div className="flex h-1.5 w-full overflow-hidden rounded-full">
              {parts.map((part, index) => (
                <Sweep
                  key={part.op}
                  delay={0.12 + index * 0.05}
                  span={0.18}
                  className="block h-full"
                  style={{
                    width: `${(part.ms / total) * 100}%`,
                    background: opColor(part.op),
                  }}
                />
              ))}
            </div>

            <div className="space-y-0.5 font-mono text-xs">
              {TXN_SPANS.map((span, index) => (
                <SpanRow
                  key={span.id}
                  span={span}
                  index={index}
                  compact={compact}
                />
              ))}
            </div>
          </div>
        </Settle>

        {/*
          The detail panel the app opens under a selected row. It is here rather
          than hanging off the edge of the panel as a floating card, and that is
          the difference the whole chapter turns on: this is where the product
          actually puts it. A card pasted over the screen annotates a
          screenshot; a panel opened in place *is* the screen, and the reader
          learns something true about using the thing.
        */}
        <Settle delay={0.34} className="mt-4 shrink-0">
          <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5 rounded-md border border-border bg-muted/20 px-4 py-3 font-mono text-[11px]">
            {(
              [
                ['op', 'http.client'],
                ['description', 'POST api.stripe.com/v1/payment_intents'],
                ['status', 'ok'],
                ['duration', '903ms'],
                ['self time', '41ms'],
                ['span_id', 'b4f0a17c9e2d5581'],
              ] as [string, string][]
            ).map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="truncate text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </Settle>
      </div>
    </MockStage>
  );
}
