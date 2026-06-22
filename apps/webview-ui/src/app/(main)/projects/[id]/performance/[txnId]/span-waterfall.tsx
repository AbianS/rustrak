import { cn } from '@/lib/utils';

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

interface WaterfallNode {
  span: Span;
  depth: number;
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
 * Builds the span tree from `parent_span_id` links and flattens it to a
 * depth-annotated DFS order. Orphan spans (parent not found) attach to the
 * root. Children are sorted by start time.
 */
function buildOrder(spans: Span[], rootSpanId?: string): WaterfallNode[] {
  const childrenByParent = new Map<string, Span[]>();
  const known = new Set(
    spans.map((s) => s.span_id).filter((id): id is string => Boolean(id)),
  );

  for (const span of spans) {
    // A span attaches to its parent only if that parent is itself in the set
    // (or is the trace root); otherwise it floats up to the root bucket.
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

  const order: WaterfallNode[] = [];
  const visited = new Set<string>();

  const walk = (parentKey: string, depth: number) => {
    const children = (childrenByParent.get(parentKey) ?? []).sort(
      (a, b) => (a.start_timestamp ?? 0) - (b.start_timestamp ?? 0),
    );
    for (const span of children) {
      if (span.span_id && visited.has(span.span_id)) continue;
      if (span.span_id) visited.add(span.span_id);
      order.push({ span, depth });
      if (span.span_id) walk(span.span_id, depth + 1);
    }
  };

  walk('__root__', 0);

  // Any spans not reached (cyclic / unreferenced) get appended flat so nothing
  // silently disappears from the view.
  for (const span of spans) {
    if (span.span_id && !visited.has(span.span_id)) {
      order.push({ span, depth: 0 });
    }
  }

  return order;
}

export function SpanWaterfall({
  spans,
  trace,
  transactionStart,
  transactionEnd,
}: SpanWaterfallProps) {
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

  const order = buildOrder(spans, trace?.span_id);

  const rootDuration =
    transactionStart != null
      ? (transactionEnd - transactionStart) * 1000
      : null;

  return (
    <div className="space-y-0.5 font-mono text-xs">
      {/* Root segment (the transaction itself) */}
      <div className="flex items-center gap-3 rounded-md bg-muted/40 px-2 py-1.5">
        <div className="w-[38%] min-w-0 flex items-center gap-2">
          <span className="font-semibold text-foreground truncate">
            {trace?.op || 'transaction'}
          </span>
          <span className="text-muted-foreground truncate">
            {trace?.description ?? ''}
          </span>
        </div>
        <div className="relative flex-1 h-4">
          <div className="absolute inset-y-0 left-0 right-0 rounded-sm bg-primary/80" />
        </div>
        <span className="w-16 text-right text-muted-foreground tabular-nums">
          {formatDuration(rootDuration)}
        </span>
      </div>

      {order.map(({ span, depth }, i) => {
        const dur = spanDuration(span);
        const start = span.start_timestamp;
        const offsetPct =
          start != null && total > 0 ? ((start - traceStart) / total) * 100 : 0;
        const widthPct =
          dur != null && total > 0
            ? Math.max(0.5, (dur / 1000 / total) * 100)
            : 0;
        const clampedWidth = Math.min(widthPct, 100 - offsetPct);
        const failed = span.status && span.status !== 'ok';

        return (
          <div
            key={span.span_id ?? `span-${i}`}
            className="flex items-center gap-3 px-2 py-1 rounded-md hover:bg-muted/30"
            title={span.description || span.op || span.span_id || ''}
          >
            <div
              className="w-[38%] min-w-0 flex items-center gap-2"
              style={{ paddingLeft: `${Math.min(depth, 8) * 12}px` }}
            >
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
            <div className="relative flex-1 h-4">
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
            <span className="w-16 text-right text-muted-foreground tabular-nums">
              {formatDuration(dur)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
