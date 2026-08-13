import type {
  OffsetPaginatedResponse,
  Result,
  RustrakError,
  Span,
} from '@rustrak/client';
import { Ok } from '@rustrak/client';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { getSpan, listSpans } from '@/features/agent-trace/api/queries';
import { defaultSelectedSpanId } from '@/features/agent-trace/model/filters';
import { AgentTraceWaterfall } from '@/features/agent-trace/ui/components/agent-trace-waterfall';
import { AiSpanDetail } from '@/features/agent-trace/ui/components/ai-span-detail';
import { getProject } from '@/features/project/api/queries';
import { loadAll } from '@/shared/lib/results';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { Badge } from '@/shared/ui/components/shadcn/badge';

interface AgentTraceDetailPageProps {
  params: Promise<{ id: string; traceId: string }>;
  searchParams: Promise<{ span?: string }>;
}

export async function generateMetadata({
  params,
}: AgentTraceDetailPageProps): Promise<Metadata> {
  const t = await getTranslations('projectPages');
  const { traceId } = await params;
  return { title: t('trace.meta.title', { traceId }) };
}

const PER_PAGE = 100;

/**
 * A trace can hold more spans than one page: the totals and the waterfall are
 * only correct over the whole trace, so pull the remaining pages too.
 */
async function collectAllSpans(
  projectId: number,
  traceId: string,
  firstPage: OffsetPaginatedResponse<Span>,
): Promise<Result<Span[], RustrakError>> {
  if (firstPage.total_pages <= 1) {
    return Ok(firstPage.items);
  }

  const rest = await Promise.all(
    Array.from({ length: firstPage.total_pages - 1 }, (_, i) =>
      listSpans(projectId, {
        trace_id: traceId,
        per_page: PER_PAGE,
        page: i + 2,
      }),
    ),
  );

  const spans = [...firstPage.items];

  for (const page of rest) {
    // A missing page is not an empty page: the waterfall's timings are only
    // correct over the whole trace, so a partial set would draw a plausible
    // and wrong picture.
    if (!page.success) {
      return page;
    }
    spans.push(...page.data.items);
  }

  return Ok(spans);
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default async function AgentTraceDetailPage({
  params,
  searchParams,
}: AgentTraceDetailPageProps) {
  const t = await getTranslations('projectPages');
  const format = await getFormatter();
  const { id, traceId } = await params;
  const { span: requestedSpanId } = await searchParams;
  const projectId = parseInt(id, 10);

  const loaded = await loadAll([
    getProject(projectId),
    listSpans(projectId, { trace_id: traceId, per_page: PER_PAGE }),
  ]);

  if (!loaded.success) {
    return <LoadFailure error={loaded.error} title={t('trace.loadFailed')} />;
  }

  const [, spansResponse] = loaded.data;
  const collected = await collectAllSpans(projectId, traceId, spansResponse);

  if (!collected.success) {
    return (
      <LoadFailure error={collected.error} title={t('trace.loadFailed')} />
    );
  }

  const spans = collected.data;

  if (spans.length === 0) {
    notFound();
  }

  const agentName = spans.find((s) => s.gen_ai_agent_name)?.gen_ai_agent_name;
  const starts = spans
    .map((s) => (s.start_timestamp ? Date.parse(s.start_timestamp) : null))
    .filter((v): v is number => v != null);
  const ends = spans
    .map((s) => (s.timestamp ? Date.parse(s.timestamp) : null))
    .filter((v): v is number => v != null);
  const duration =
    starts.length > 0 && ends.length > 0
      ? Math.max(...ends) - Math.min(...starts)
      : null;
  // Agent spans aggregate their children's usage, so including them here
  // would count the same tokens twice — the Traces query excludes them too.
  const totalTokens = spans
    .filter((s) => s.gen_ai_operation_type !== 'agent')
    .reduce((sum, s) => sum + (s.gen_ai_usage_total_tokens ?? 0), 0);
  const toolCallCount = spans.filter(
    (s) => s.gen_ai_operation_type === 'tool',
  ).length;
  const llmCallCount = spans.filter(
    (s) => s.gen_ai_operation_type === 'ai_client',
  ).length;
  const errorCount = spans.filter(
    (s) => s.status != null && s.status !== 'ok',
  ).length;
  // Response model where the SDK reported one, request model otherwise: a
  // failed call has no response model but still names what it tried to call.
  const models = [
    ...new Set(
      spans.flatMap((s) => {
        const model = s.gen_ai_response_model ?? s.gen_ai_request_model;
        return model ? [model] : [];
      }),
    ),
  ];
  const startedAt = starts.length > 0 ? Math.min(...starts) : null;

  // Opening a trace with an empty details panel wastes the whole right half
  // of the page on "select a span". Sentry defaults to the first generation
  // span for the same reason, and the URL stays clean until the reader picks
  // one themselves.
  //
  // A requested id is honoured only if it belongs to this trace. `getSpan` is
  // scoped to the project, not the trace, so without this check a span from
  // another trace would render beside this one's waterfall — the URL and the
  // panel describing different things. It also means the only ids that ever
  // reach the request are ones already loaded from the server.
  const requestedSpanIsInTrace =
    requestedSpanId != null && spans.some((s) => s.id === requestedSpanId);
  const selectedSpanId = requestedSpanIsInTrace
    ? requestedSpanId
    : requestedSpanId == null
      ? defaultSelectedSpanId(spans)
      : undefined;
  const requestedSpanMissing =
    requestedSpanId != null && !requestedSpanIsInTrace;

  // Only the selected span: attributes are the one part of a span that is
  // never trimmed server-side, so they are pulled one at a time.
  const selected =
    selectedSpanId != null ? await getSpan(projectId, selectedSpanId) : null;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="shrink-0 w-full px-4 md:px-8 py-4 md:py-6 border-b">
        <Link
          href={`/projects/${projectId}/agents`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="size-4" />
          {t('trace.backLink')}
        </Link>
        <h1 className="font-mono text-lg font-semibold break-all">
          {agentName || t('trace.unnamed')}
        </h1>
        <div className="mt-2 flex items-center gap-2 flex-wrap text-sm">
          <span className="font-mono font-semibold">
            {formatDuration(duration)}
          </span>
          <Badge variant="secondary">
            {t('trace.tokens', { count: format.number(totalTokens) })}
          </Badge>
          {llmCallCount > 0 && (
            <Badge variant="outline">
              {t('trace.llmCalls', { count: llmCallCount })}
            </Badge>
          )}
          {toolCallCount > 0 && (
            <Badge variant="outline">
              {t('trace.toolCalls', { count: toolCallCount })}
            </Badge>
          )}
          {errorCount > 0 && (
            <Badge variant="destructive">
              {t('trace.errors', { count: errorCount })}
            </Badge>
          )}
          {models.map((model) => (
            <Badge key={model} variant="outline" className="font-mono">
              {model}
            </Badge>
          ))}
          {startedAt != null && (
            <span className="text-xs text-muted-foreground">
              {format.dateTime(new Date(startedAt), 'precise')}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground font-mono truncate">
          {traceId}
        </p>
      </div>

      {/* Two panes on a wide screen, stacked on a narrow one. The details
          panel scrolls independently: a long prompt must not push the
          waterfall out of view, since reading them side by side is the point. */}
      <div className="flex-1 min-h-0 w-full px-4 md:px-8 py-4 md:py-6 flex flex-col lg:flex-row gap-4 overflow-auto lg:overflow-hidden">
        <section className="rounded-lg border flex flex-col min-h-0 lg:flex-1">
          <div className="border-b px-4 py-2.5 flex items-center justify-between shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t('trace.spans')}
            </h2>
            <span className="text-xs text-muted-foreground">
              {t('spanCount', { count: spans.length })}
            </span>
          </div>
          <div className="p-3 lg:overflow-auto">
            <AgentTraceWaterfall
              spans={spans}
              projectId={projectId}
              traceId={traceId}
              selectedSpanId={selectedSpanId}
            />
          </div>
        </section>

        <section className="rounded-lg border flex flex-col min-h-0 lg:w-[480px] lg:shrink-0">
          <div className="border-b px-4 py-2.5 shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t('trace.spanDetail')}
            </h2>
          </div>
          <div className="p-4 lg:overflow-auto">
            {requestedSpanMissing ||
            (selected?.success === false &&
              selected.error.kind === 'not_found') ? (
              // A stale link, not an outage — say so in place rather than
              // replacing the whole trace view with a failure surface.
              <p className="text-sm text-muted-foreground">
                {t('trace.spanUnavailable')}
              </p>
            ) : selected == null ? (
              <p className="text-sm text-muted-foreground">
                {t('trace.selectSpan')}
              </p>
            ) : selected.success ? (
              <AiSpanDetail span={selected.data} />
            ) : (
              // Anything else is a real failure. Reporting a timeout or a 500
              // as "that span is no longer available" would send the reader
              // looking for a deleted span that is still there.
              <LoadFailure
                error={selected.error}
                title={t('trace.loadFailed')}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
