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
import {
  resolveSelectedSpan,
  summarizeTrace,
} from '@/features/agent-trace/model/trace-summary';
import { AgentTraceWaterfall } from '@/features/agent-trace/ui/components/agent-trace-waterfall';
import { SpanDetailPane } from '@/features/agent-trace/ui/components/span-detail-pane';
import { TraceSummaryBadges } from '@/features/agent-trace/ui/components/trace-summary-badges';
import { getProject } from '@/features/project/api/queries';
import { loadAll } from '@/shared/lib/results';
import { LoadFailure } from '@/shared/ui/components/load-failure';

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

function _formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default async function AgentTraceDetailPage({
  params,
  searchParams,
}: AgentTraceDetailPageProps) {
  const t = await getTranslations('projectPages');
  const _format = await getFormatter();
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

  const summary = summarizeTrace(spans);

  const { selectedSpanId, requestedMissing } = resolveSelectedSpan(
    spans,
    requestedSpanId,
  );

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
          {summary.agentName || t('trace.unnamed')}
        </h1>
        <TraceSummaryBadges summary={summary} />

        <p className="mt-1 text-xs text-muted-foreground font-mono truncate">
          {traceId}
        </p>
      </div>

      {/* Two panes on a wide screen, stacked on a narrow one. The details
          panel scrolls independently: a long prompt must not push the
          waterfall out of view, since reading them side by side is the point. */}
      <div className="flex-1 min-h-0 w-full px-4 md:px-8 py-4 md:py-6 flex flex-col lg:flex-row gap-4 overflow-auto lg:overflow-hidden">
        {/* min-w-0 lets this pane shrink below its content's intrinsic width —
    without it a long span label makes the pane grow and push the details
    panel out of the clipped container instead of truncating. */}
        <section className="rounded-lg border flex flex-col min-h-0 min-w-0 lg:flex-1">
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
            <SpanDetailPane
              selected={selected}
              requestedMissing={requestedMissing}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
