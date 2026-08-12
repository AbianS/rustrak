'use client';

import type { Span } from '@rustrak/client';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { type KeyboardEvent, useMemo, useState } from 'react';
import { cn } from '@/shared/lib/utils';

interface AgentTraceWaterfallProps {
  spans: Span[];
}

interface TreeNode {
  span: Span;
  depth: number;
  children: TreeNode[];
}

interface FlatRow {
  span: Span;
  depth: number;
  hasChildren: boolean;
  collapsed: boolean;
  selfMs: number | null;
}

// gen_ai.operation.type takes precedence over the op-prefix palette below —
// it's the semantically meaningful axis for an agent trace (agent vs tool vs
// raw LLM call vs handoff), whereas `op` is often just "gen_ai.invoke_agent".
const OPERATION_TYPE_COLOR: Record<string, string> = {
  agent: 'bg-violet-500',
  tool: 'bg-amber-500',
  ai_client: 'bg-emerald-500',
  handoff: 'bg-cyan-500',
};

function opColor(span: Span): string {
  const genAiColor = span.gen_ai_operation_type
    ? OPERATION_TYPE_COLOR[span.gen_ai_operation_type]
    : undefined;
  if (genAiColor) return genAiColor;
  const o = (span.op ?? '').toLowerCase();
  if (o.startsWith('db')) return 'bg-blue-500';
  if (o.startsWith('http')) return 'bg-emerald-500';
  if (o.startsWith('resource')) return 'bg-purple-500';
  if (o.startsWith('ui') || o.includes('render')) return 'bg-orange-500';
  if (o.startsWith('cache')) return 'bg-pink-500';
  if (o.startsWith('rpc') || o.startsWith('grpc')) return 'bg-cyan-500';
  return 'bg-primary';
}

function epochMs(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * The formatter is passed in, exactly like `t`.
 *
 * `useFormatter` is a hook, and this is a builder rather than a component, so
 * it cannot reach for one itself. The component that calls it already threads
 * the translator through for the same reason.
 */
type Formatter = ReturnType<typeof useFormatter>;

function formatTokens(n: number | null, format: Formatter): string {
  if (n == null) return '—';
  return format.number(n);
}

/**
 * Builds the span tree from `parent_span_id` links. Orphan spans (parent not
 * found in this trace) attach to a synthetic root — unlike the transaction
 * waterfall there's no single segment span guaranteed to anchor everything,
 * since a trace can span multiple standalone-span "segments".
 */
function buildTree(spans: Span[]): TreeNode[] {
  const known = new Set(
    spans.map((s) => s.span_id).filter((id): id is string => Boolean(id)),
  );
  const childrenByParent = new Map<string, Span[]>();

  for (const span of spans) {
    const key =
      span.parent_span_id && known.has(span.parent_span_id)
        ? span.parent_span_id
        : '__root__';
    const list = childrenByParent.get(key) ?? [];
    list.push(span);
    childrenByParent.set(key, list);
  }

  const visited = new Set<string>();
  const build = (parentKey: string, depth: number): TreeNode[] => {
    const children = (childrenByParent.get(parentKey) ?? []).sort(
      (a, b) =>
        (epochMs(a.start_timestamp) ?? 0) - (epochMs(b.start_timestamp) ?? 0),
    );
    const nodes: TreeNode[] = [];
    for (const span of children) {
      if (span.span_id && visited.has(span.span_id)) continue;
      if (span.span_id) visited.add(span.span_id);
      nodes.push({
        span,
        depth,
        children: span.span_id ? build(span.span_id, depth + 1) : [],
      });
    }
    return nodes;
  };

  const roots = build('__root__', 0);
  for (const span of spans) {
    if (span.span_id && !visited.has(span.span_id)) {
      roots.push({ span, depth: 0, children: [] });
    }
  }
  return roots;
}

/** Self time in ms: the `exclusive_time_ms` column, already computed server-side. */
function selfTime(node: TreeNode): number | null {
  return node.span.exclusive_time_ms ?? node.span.duration_ms;
}

function flatten(nodes: TreeNode[], collapsed: Set<string>): FlatRow[] {
  const out: FlatRow[] = [];
  const walk = (list: TreeNode[]) => {
    for (const node of list) {
      const hasChildren = node.children.length > 0;
      const isCollapsed = node.span.span_id
        ? collapsed.has(node.span.span_id)
        : false;
      out.push({
        span: node.span,
        depth: node.depth,
        hasChildren,
        collapsed: isCollapsed,
        selfMs: selfTime(node),
      });
      if (hasChildren && !isCollapsed) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

function opBreakdown(tree: TreeNode[]): { color: string; ms: number }[] {
  const byColor = new Map<string, number>();
  const walk = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      const self = selfTime(node) ?? 0;
      const color = opColor(node.span);
      byColor.set(color, (byColor.get(color) ?? 0) + self);
      walk(node.children);
    }
  };
  walk(tree);
  return [...byColor.entries()]
    .flatMap(([color, ms]) => (ms > 0 ? [{ color, ms }] : []))
    .sort((a, b) => b.ms - a.ms);
}

/**
 * Waterfall for one agent trace. Unlike `SpanWaterfall` (transaction detail),
 * spans here come from `listSpans({ trace_id })` — the flat `spans` table
 * shape, which covers both standalone and transaction-embedded spans
 * uniformly and already carries precomputed `duration_ms`/`exclusive_time_ms`
 * plus the gen_ai.* columns needed for the detail panel.
 */
export function AgentTraceWaterfall({ spans }: AgentTraceWaterfallProps) {
  const t = useTranslations('agents');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(spans), [spans]);
  const rows = useMemo(() => flatten(tree, collapsed), [tree, collapsed]);
  const breakdown = useMemo(() => opBreakdown(tree), [tree]);

  const starts = spans
    .map((s) => epochMs(s.start_timestamp))
    .filter((v): v is number => v != null);
  const ends = spans
    .map((s) => epochMs(s.timestamp))
    .filter((v): v is number => v != null);
  const traceStart = starts.length > 0 ? Math.min(...starts) : 0;
  const traceEnd = ends.length > 0 ? Math.max(...ends) : 0;
  const total = traceEnd - traceStart;

  const breakdownTotal = breakdown.reduce((a, b) => a + b.ms, 0);

  const toggle = (id?: string | null) => {
    if (!id) return;
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (spans.length === 0) {
    return (
      <p className="text-sm text-muted-foreground px-1 py-4 text-center">
        {t('empty.noSpans')}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {breakdownTotal > 0 && (
        <div className="flex h-1.5 w-full overflow-hidden rounded-full">
          {breakdown.map((b) => (
            <div
              key={b.color}
              className={b.color}
              style={{ width: `${(b.ms / breakdownTotal) * 100}%` }}
              title={formatDuration(b.ms)}
            />
          ))}
        </div>
      )}

      <div className="space-y-0.5 font-mono text-xs">
        {rows.map(
          ({ span, depth, hasChildren, collapsed: isCol, selfMs }, i) => {
            const dur = span.duration_ms;
            const start = epochMs(span.start_timestamp);
            const offsetPct =
              start != null && total > 0
                ? ((start - traceStart) / total) * 100
                : 0;
            const widthPct =
              dur != null && total > 0 ? Math.max(0.5, (dur / total) * 100) : 0;
            const clampedWidth = Math.min(widthPct, 100 - offsetPct);
            const failed = span.status && span.status !== 'ok';
            const isSelected =
              span.span_id != null && selected === span.span_id;
            const label =
              span.gen_ai_agent_name ||
              span.gen_ai_tool_name ||
              span.gen_ai_response_model ||
              span.description;

            const selectKey = (e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelected(isSelected ? null : (span.span_id ?? null));
              }
            };

            return (
              // `span_id` is the key wherever the span has one. The index is
              // the fallback for a span the SDK sent without an id, which
              // nothing else can distinguish.
              // react-doctor-disable-next-line react-doctor/no-array-index-as-key
              <div key={span.span_id ?? `span-${i}`}>
                {/* biome-ignore lint/a11y/useSemanticElements: the row contains
                    its own collapse <button>, and a <button> nested inside a
                    <button> is invalid HTML. */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setSelected(isSelected ? null : (span.span_id ?? null))
                  }
                  onKeyDown={selectKey}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1 text-left hover:bg-muted/40',
                    isSelected && 'bg-muted/50',
                  )}
                >
                  <div
                    className="flex w-[38%] min-w-0 items-center gap-1"
                    style={{ paddingLeft: `${Math.min(depth, 8) * 12}px` }}
                  >
                    {hasChildren ? (
                      // The row itself is the selectable control, and this is a
                      // second control inside it. Nesting is unavoidable here:
                      // the row cannot be a <button> without making this one
                      // invalid HTML, which is why the row is a div with a
                      // role and its own keyboard handling.
                      // react-doctor-disable-next-line react-doctor/html-no-nested-interactive
                      <button
                        type="button"
                        aria-label={
                          isCol
                            ? t('waterfall.expand')
                            : t('waterfall.collapse')
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(span.span_id);
                        }}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        {isCol ? (
                          <ChevronRight className="size-3" />
                        ) : (
                          <ChevronDown className="size-3" />
                        )}
                      </button>
                    ) : (
                      <span className="inline-block size-3 shrink-0" />
                    )}
                    <span
                      className={cn(
                        'shrink-0 rounded px-1 py-px text-[10px] font-medium text-white',
                        opColor(span),
                      )}
                    >
                      {span.gen_ai_operation_type ||
                        span.op ||
                        t('waterfall.spanFallback')}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {label || '—'}
                    </span>
                    {failed && (
                      <span className="shrink-0 rounded bg-destructive/15 px-1 text-[10px] text-destructive">
                        {span.status}
                      </span>
                    )}
                  </div>
                  <div className="relative h-4 flex-1">
                    <div
                      className={cn(
                        'absolute inset-y-0 rounded-sm',
                        opColor(span),
                      )}
                      style={{
                        left: `${offsetPct}%`,
                        width: `${clampedWidth}%`,
                      }}
                    />
                  </div>
                  <span className="w-16 text-right tabular-nums text-muted-foreground">
                    {formatDuration(dur)}
                  </span>
                </div>

                {isSelected && <SpanDetail span={span} selfMs={selfMs} />}
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}

function SpanDetail({ span, selfMs }: { span: Span; selfMs: number | null }) {
  const t = useTranslations('agents');
  const format = useFormatter();
  const rows: { key: string; label: string; value: string }[] = [
    {
      key: 'op',
      label: t('detail.op'),
      value: span.op ?? '—',
    },
    {
      key: 'description',
      label: t('detail.description'),
      value: span.description ?? '—',
    },
    {
      key: 'status',
      label: t('detail.status'),
      value: span.status ?? '—',
    },
    {
      key: 'duration',
      label: t('detail.duration'),
      value: formatDuration(span.duration_ms),
    },
    {
      key: 'selfTime',
      label: t('detail.selfTime'),
      value: formatDuration(selfMs),
    },
    {
      key: 'spanId',
      label: t('detail.spanId'),
      value: span.span_id ?? '—',
    },
    {
      key: 'parentSpanId',
      label: t('detail.parentSpanId'),
      value: span.parent_span_id ?? '—',
    },
  ];

  const isAiSpan = span.gen_ai_operation_type != null;
  const genAiRows: { key: string; label: string; value: string }[] = [
    {
      key: 'operationType',
      label: t('detail.operationType'),
      value: span.gen_ai_operation_type ?? '—',
    },
    {
      key: 'agentName',
      label: t('detail.agentName'),
      value: span.gen_ai_agent_name ?? '—',
    },
    {
      key: 'toolName',
      label: t('detail.toolName'),
      value: span.gen_ai_tool_name ?? '—',
    },
    {
      key: 'requestModel',
      label: t('detail.requestModel'),
      value: span.gen_ai_request_model ?? '—',
    },
    {
      key: 'responseModel',
      label: t('detail.responseModel'),
      value: span.gen_ai_response_model ?? '—',
    },
    {
      key: 'conversationId',
      label: t('detail.conversationId'),
      value: span.gen_ai_conversation_id ?? '—',
    },
    {
      key: 'inputTokens',
      label: t('detail.inputTokens'),
      value: formatTokens(span.gen_ai_usage_input_tokens, format),
    },
    {
      key: 'outputTokens',
      label: t('detail.outputTokens'),
      value: formatTokens(span.gen_ai_usage_output_tokens, format),
    },
    {
      key: 'totalTokens',
      label: t('detail.totalTokens'),
      value: formatTokens(span.gen_ai_usage_total_tokens, format),
    },
  ];

  return (
    <dl className="ml-6 mt-0.5 mb-1 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 rounded-md border bg-muted/20 px-3 py-2 text-[11px]">
      {rows.map((row) => (
        <div key={row.key} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="truncate break-all text-foreground">{row.value}</dd>
        </div>
      ))}
      {isAiSpan && (
        <>
          <div className="col-span-2 mt-1 border-t pt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {t('detail.genAiSection')}
          </div>
          {genAiRows.map((row) => (
            <div key={row.key} className="contents">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="truncate break-all text-foreground">
                {row.value}
              </dd>
            </div>
          ))}
        </>
      )}
    </dl>
  );
}
