'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { type KeyboardEvent, useMemo, useState } from 'react';
import { cn } from '@/shared/lib/utils';

/**
 * A single Sentry span. Every field is optional — SDKs omit most of them; a
 * minimal legal span is `{ span_id, start_timestamp, timestamp }`.
 */
export interface Span {
  span_id?: string;
  parent_span_id?: string;
  op?: string;
  description?: string;
  status?: string;
  start_timestamp?: number;
  timestamp?: number;
  exclusive_time?: number;
}

export interface TraceContext {
  span_id?: string;
  op?: string;
  status?: string;
  description?: string;
}

interface SpanWaterfallProps {
  spans: Span[];
  trace?: TraceContext;
  /** Transaction-level bounds (epoch seconds) for the root bar. */
  transactionStart?: number;
  transactionEnd: number;
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
  /** Exclusive (self) time in ms: own duration minus direct children. */
  selfMs: number | null;
}

// Map a span op to a bar color. Prefix match keeps it resilient to the long
// tail of op values SDKs emit (db.sql.query, http.client, resource.script…).
function opColor(op?: string): string {
  const o = (op ?? '').toLowerCase();
  if (o.startsWith('db')) return 'bg-blue-500';
  if (o.startsWith('http')) return 'bg-emerald-500';
  if (o.startsWith('resource')) return 'bg-purple-500';
  if (o.startsWith('ui') || o.includes('render')) return 'bg-orange-500';
  if (o.startsWith('cache')) return 'bg-pink-500';
  if (o.startsWith('rpc') || o.startsWith('grpc')) return 'bg-cyan-500';
  return 'bg-primary';
}

function spanDuration(span: Span): number | null {
  if (span.start_timestamp == null || span.timestamp == null) return null;
  return (span.timestamp - span.start_timestamp) * 1000;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Builds the span tree from `parent_span_id` links. Orphan spans (parent not
 * found) attach to the root. Children are sorted by start time. Cyclic /
 * unreferenced spans are appended flat so nothing silently disappears.
 */
function buildTree(spans: Span[], rootSpanId?: string): TreeNode[] {
  const known = new Set(
    spans.map((s) => s.span_id).filter((id): id is string => Boolean(id)),
  );
  const childrenByParent = new Map<string, Span[]>();

  for (const span of spans) {
    const parent =
      span.parent_span_id &&
      (known.has(span.parent_span_id) || span.parent_span_id === rootSpanId)
        ? span.parent_span_id
        : '__root__';
    const key = parent === rootSpanId ? '__root__' : parent;
    const list = childrenByParent.get(key) ?? [];
    list.push(span);
    childrenByParent.set(key, list);
  }

  const visited = new Set<string>();
  const build = (parentKey: string, depth: number): TreeNode[] => {
    const children = (childrenByParent.get(parentKey) ?? []).sort(
      (a, b) => (a.start_timestamp ?? 0) - (b.start_timestamp ?? 0),
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

/**
 * Self (exclusive) time in ms. Prefers the SDK-provided `exclusive_time` (the
 * source of truth, correct even when children overlap or extend past the
 * parent); falls back to own duration minus direct children when absent.
 */
function selfTime(node: TreeNode): number | null {
  if (node.span.exclusive_time != null) return node.span.exclusive_time;
  const own = spanDuration(node.span);
  if (own == null) return null;
  const childSum = node.children.reduce(
    (acc, c) => acc + (spanDuration(c.span) ?? 0),
    0,
  );
  return Math.max(0, own - childSum);
}

/** Flattens the tree to a DFS row list, skipping collapsed subtrees. */
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

/** Aggregates self-time per op color for the breakdown bar. */
function opBreakdown(tree: TreeNode[]): { color: string; ms: number }[] {
  const byColor = new Map<string, number>();
  const walk = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      const self = selfTime(node) ?? 0;
      const color = opColor(node.span.op);
      byColor.set(color, (byColor.get(color) ?? 0) + self);
      walk(node.children);
    }
  };
  walk(tree);
  return [...byColor.entries()]
    .map(([color, ms]) => ({ color, ms }))
    .filter((e) => e.ms > 0)
    .sort((a, b) => b.ms - a.ms);
}

export function SpanWaterfall({
  spans,
  trace,
  transactionStart,
  transactionEnd,
}: SpanWaterfallProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);

  const tree = useMemo(
    () => buildTree(spans, trace?.span_id),
    [spans, trace?.span_id],
  );
  const rows = useMemo(() => flatten(tree, collapsed), [tree, collapsed]);
  const breakdown = useMemo(() => opBreakdown(tree), [tree]);

  const starts = spans
    .map((s) => s.start_timestamp)
    .filter((v): v is number => v != null);
  const ends = spans
    .map((s) => s.timestamp)
    .filter((v): v is number => v != null);

  const traceStart = starts.reduce(
    (a, b) => Math.min(a, b),
    transactionStart ?? Infinity,
  );
  const traceEnd = ends.reduce((a, b) => Math.max(a, b), transactionEnd);
  const total = traceEnd - traceStart;

  const rootDuration =
    transactionStart != null
      ? (transactionEnd - transactionStart) * 1000
      : null;

  const breakdownTotal = breakdown.reduce((a, b) => a + b.ms, 0);

  const toggle = (id?: string) => {
    if (!id) return;
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {/* Op breakdown: share of self-time per operation kind. */}
      {breakdownTotal > 0 && (
        <div className="flex h-1.5 w-full overflow-hidden rounded-full">
          {breakdown.map((b) => (
            <div
              key={b.color}
              className={b.color}
              style={{ width: `${(b.ms / breakdownTotal) * 100}%` }}
              title={`${formatDuration(b.ms)}`}
            />
          ))}
        </div>
      )}

      <div className="space-y-0.5 font-mono text-xs">
        {/* Root segment (the transaction itself) */}
        <div className="flex items-center gap-3 rounded-md bg-muted/40 px-2 py-1.5">
          <div className="flex w-[38%] min-w-0 items-center gap-2">
            <span className="truncate font-semibold text-foreground">
              {trace?.op || 'transaction'}
            </span>
            <span className="truncate text-muted-foreground">
              {trace?.description ?? ''}
            </span>
          </div>
          <div className="relative h-4 flex-1">
            <div className="absolute inset-y-0 left-0 right-0 rounded-sm bg-primary/80" />
          </div>
          <span className="w-16 text-right tabular-nums text-muted-foreground">
            {formatDuration(rootDuration)}
          </span>
        </div>

        {rows.map(
          ({ span, depth, hasChildren, collapsed: isCol, selfMs }, i) => {
            const dur = spanDuration(span);
            const start = span.start_timestamp;
            const offsetPct =
              start != null && total > 0
                ? ((start - traceStart) / total) * 100
                : 0;
            const widthPct =
              dur != null && total > 0
                ? Math.max(0.5, (dur / 1000 / total) * 100)
                : 0;
            const clampedWidth = Math.min(widthPct, 100 - offsetPct);
            const failed = span.status && span.status !== 'ok';
            const isSelected =
              span.span_id != null && selected === span.span_id;

            const selectKey = (e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelected(isSelected ? null : (span.span_id ?? null));
              }
            };

            return (
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
                      <button
                        type="button"
                        aria-label={isCol ? 'Expand' : 'Collapse'}
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
                        opColor(span.op),
                      )}
                    >
                      {span.op || 'span'}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {span.description || '—'}
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
                        opColor(span.op),
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

                {isSelected && (
                  <SpanDetail span={span} dur={dur} selfMs={selfMs} />
                )}
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}

function SpanDetail({
  span,
  dur,
  selfMs,
}: {
  span: Span;
  dur: number | null;
  selfMs: number | null;
}) {
  const rows: [string, string][] = [
    ['op', span.op ?? '—'],
    ['description', span.description ?? '—'],
    ['status', span.status ?? '—'],
    ['duration', formatDuration(dur)],
    ['self time', formatDuration(selfMs)],
    ['span_id', span.span_id ?? '—'],
    ['parent_span_id', span.parent_span_id ?? '—'],
  ];
  return (
    <dl className="ml-6 mt-0.5 mb-1 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 rounded-md border bg-muted/20 px-3 py-2 text-[11px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="truncate break-all text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
