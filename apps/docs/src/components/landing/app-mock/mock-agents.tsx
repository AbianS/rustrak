'use client';

import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompact } from './design';
import type { MockSpan, OperationType } from './fixtures';
import { SPANS } from './fixtures';
import { MockBadge, MockShell, usePad } from './mock-shell';
import { Enter, MockStage, Settle, Sweep } from './stage';

/**
 * One agent trace, recreated from
 * `projects/[id]/agents/[traceId]/agent-trace-waterfall.tsx`.
 *
 * The colour is the meaning here. `gen_ai.operation.type` takes precedence over
 * the op-prefix palette because it is the semantically useful axis for an agent
 * run — agent, tool, raw LLM call, handoff — and each row wears its type as a
 * chip in the type's colour, with the bar in the same colour beneath it. A
 * waterfall painted in one brand colour would throw that away and leave a
 * pretty chart that answers nothing.
 *
 * The bars sweep out from their own start, delayed by where the span begins in
 * the trace, so the run replays in the order it happened rather than filling in
 * top to bottom. It is the one place on this page where the animation *is* the
 * data.
 */

/** `OPERATION_TYPE_COLOR` from the real waterfall. */
const OPERATION_COLOR: Record<OperationType, string> = {
  agent: 'bg-violet-500',
  tool: 'bg-amber-500',
  ai_client: 'bg-emerald-500',
  handoff: 'bg-cyan-500',
};

const TRACE_MS = 8420;

/**
 * The waterfall's two columns, as a fraction of the row and a fixed width.
 *
 * Stated in one place so the label column and the duration column keep the same
 * widths in the header row and in every span row. The timeline is whatever is
 * left between them, so the bars only line up with each other while these two
 * numbers agree.
 */
const LAYOUT = {
  wide: { names: 'w-[38%]', time: 'w-16' },
  compact: { names: 'w-[46%]', time: 'w-12' },
} as const;

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * The op-breakdown bar: self time per operation type across the whole trace,
 * which is the one-glance answer to "where did the eight seconds go".
 */
function Breakdown() {
  const byType = new Map<OperationType, number>();
  for (const span of SPANS) {
    // Self time: an agent span's own time is what its children do not account
    // for, so the segments sum to the trace instead of double-counting it.
    const children = SPANS.filter((s) => s.depth > span.depth);
    const self =
      span.depth === 0
        ? span.durationMs - children.reduce((n, c) => n + c.durationMs, 0)
        : span.durationMs;
    byType.set(span.operation, (byType.get(span.operation) ?? 0) + self);
  }

  const entries = [...byType.entries()].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((n, [, ms]) => n + ms, 0);

  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full">
      {entries.map(([type, ms], index) => (
        <Sweep
          key={type}
          delay={0.15 + index * 0.09}
          className={cn('block h-full', OPERATION_COLOR[type])}
          style={{ width: `${(ms / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

function SpanRow({ span, index }: { span: MockSpan; index: number }) {
  const layout = LAYOUT[useCompact() ? 'compact' : 'wide'];
  const failed = span.status !== 'ok';
  const offset = (span.startMs / TRACE_MS) * 100;
  const width = Math.max(0.5, (span.durationMs / TRACE_MS) * 100);

  return (
    <div>
      <Enter
        index={index}
        delay={0.2}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-2 py-1 text-left',
          index === 0 && 'bg-muted/50',
        )}
      >
        <div
          className={cn('flex min-w-0 items-center gap-1', layout.names)}
          style={{ paddingLeft: `${span.depth * 12}px` }}
        >
          <ChevronDown
            className={cn(
              'size-3 shrink-0 text-muted-foreground',
              span.depth > 0 && 'invisible',
            )}
          />
          <span
            className={cn(
              'shrink-0 rounded px-1 py-px text-[10px] font-medium text-white',
              OPERATION_COLOR[span.operation],
            )}
          >
            {span.operation}
          </span>
          <span className="truncate text-muted-foreground">{span.label}</span>
          {failed ? (
            <span className="shrink-0 rounded bg-destructive/15 px-1 text-[10px] text-destructive">
              {span.status}
            </span>
          ) : null}
        </div>

        <div className="relative h-4 flex-1">
          <Sweep
            // Delayed by where the span starts: the run replays in order.
            delay={0.18 + (span.startMs / TRACE_MS) * 0.45}
            className={cn(
              'absolute inset-y-0 rounded-sm',
              OPERATION_COLOR[span.operation],
            )}
            style={{ left: `${offset}%`, width: `${width}%` }}
          />
        </div>

        <span
          className={cn(
            'text-right tabular-nums text-muted-foreground',
            layout.time,
          )}
        >
          {formatDuration(span.durationMs)}
        </span>
      </Enter>

      {/* The selected span, opened to its attributes. `gen_ai` is broken out
          below the generic block, exactly as `SpanDetail` splits it. */}
      {index === 1 ? <SpanDetail span={span} /> : null}
    </div>
  );
}

function SpanDetail({ span }: { span: MockSpan }) {
  const compact = useCompact();
  const rows: Array<[string, string]> = [
    ['op', span.op],
    ['description', `chat ${span.label}`],
    ['status', span.status],
    ['duration', formatDuration(span.durationMs)],
    ['self time', formatDuration(span.durationMs)],
  ];

  const genAi: Array<[string, string]> = [
    ['operation type', span.operation],
    ['response model', span.label],
    ['input tokens', (span.inputTokens ?? 0).toLocaleString()],
    ['output tokens', (span.outputTokens ?? 0).toLocaleString()],
    [
      'total tokens',
      ((span.inputTokens ?? 0) + (span.outputTokens ?? 0)).toLocaleString(),
    ],
  ];

  return (
    <Settle delay={0.5}>
      <dl
        className={cn(
          'mb-1 ml-6 mt-0.5 grid gap-x-3 gap-y-1 rounded-md border border-border bg-muted/20 px-3 py-2 text-[11px]',
          compact ? 'grid-cols-[6.5rem_1fr]' : 'grid-cols-[8rem_1fr]',
        )}
      >
        {rows.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-muted-foreground">{key}</dt>
            <dd className="truncate break-all text-foreground">{value}</dd>
          </div>
        ))}
        <div className="col-span-2 mt-1 border-t border-border pt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          gen_ai
        </div>
        {genAi.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-muted-foreground">{key}</dt>
            <dd className="truncate break-all text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </Settle>
  );
}

export function MockAgents() {
  const pad = usePad();
  const tokens = SPANS.filter((s) => s.operation !== 'agent').reduce(
    (n, s) => n + (s.inputTokens ?? 0) + (s.outputTokens ?? 0),
    0,
  );
  const toolCalls = SPANS.filter((s) => s.operation === 'tool').length;

  return (
    <MockStage>
      <MockShell active="Agents">
        {/* The real page opens with a "← Agents" back link above the title. It
            is gone here, and only here: this screen is shown as a cropped
            surface rather than inside the app shell (see `Bare` in
            mock-shell.tsx), so there is no navigation for it to go back to and
            nothing on the landing it could mean. It was also the first thing
            the window clipped, which is a poor use of the one row of the trace
            header that has to survive. */}
        <div className={cn('shrink-0 border-b border-border py-6', pad)}>
          <h1 className="break-all font-mono text-lg font-semibold">
            support-triage-agent
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono font-semibold">8.42s</span>
            <MockBadge>{tokens.toLocaleString()} tokens</MockBadge>
            <MockBadge variant="outline">{toolCalls} tool calls</MockBadge>
            <span className="text-xs text-muted-foreground">
              Jul 24, 2026, 14:22:04
            </span>
          </div>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
            9f58f1872ac04d1e5b7c3a0e94d2f618
          </p>
        </div>

        <div className={cn('min-h-0 flex-1 overflow-hidden py-6', pad)}>
          <Settle className="rounded-lg border border-border">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Spans
              </h2>
              <span className="text-xs text-muted-foreground">
                {SPANS.length} spans
              </span>
            </div>

            <div className="space-y-2 p-3">
              <Breakdown />
              {/*
                There used to be a playhead here: a white vertical bar sweeping
                across the timeline column on a loop, on the theory that a trace
                is a recording and a recording that has stopped looks like a
                picture of one.

                It is gone, and the theory was the problem. The bars already
                sweep out from their own start, delayed by where each span
                begins, so the run *does* replay in the order it happened. That
                is the honest motion and it carries real data. A second marker
                crossing the same column afterwards said nothing the bars had
                not already said, and said it in full-strength foreground over a
                surface where nothing else is: the loudest thing in the chapter
                was the one element with no meaning attached.
              */}
              <div className="relative space-y-0.5 font-mono text-xs">
                {SPANS.map((span, index) => (
                  <SpanRow key={span.id} span={span} index={index} />
                ))}
              </div>
            </div>
          </Settle>
        </div>
      </MockShell>
    </MockStage>
  );
}
