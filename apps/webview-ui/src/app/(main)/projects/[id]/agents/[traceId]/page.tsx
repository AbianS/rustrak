import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listSpans } from '@/actions/agents';
import { getProject } from '@/actions/projects';
import { Badge } from '@/components/ui/badge';
import { AgentTraceWaterfall } from './agent-trace-waterfall';

interface AgentTraceDetailPageProps {
  params: Promise<{ id: string; traceId: string }>;
}

export async function generateMetadata({
  params,
}: AgentTraceDetailPageProps): Promise<Metadata> {
  const { traceId } = await params;
  return { title: `${traceId} | Agents | Rustrak` };
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default async function AgentTraceDetailPage({
  params,
}: AgentTraceDetailPageProps) {
  const { id, traceId } = await params;
  const projectId = parseInt(id, 10);

  const [project, spansResponse] = await Promise.all([
    getProject(projectId),
    listSpans(projectId, { trace_id: traceId, per_page: 100 }),
  ]);

  if (!project) {
    notFound();
  }

  const spans = spansResponse.items;

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
  const totalTokens = spans.reduce(
    (sum, s) => sum + (s.gen_ai_usage_total_tokens ?? 0),
    0,
  );
  const toolCallCount = spans.filter(
    (s) => s.gen_ai_operation_type === 'tool',
  ).length;
  const startedAt = starts.length > 0 ? Math.min(...starts) : null;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="shrink-0 w-full px-4 md:px-8 py-4 md:py-6 border-b">
        <Link
          href={`/projects/${projectId}/agents`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="size-4" />
          Agents
        </Link>
        <h1 className="font-mono text-lg font-semibold break-all">
          {agentName || '(unnamed agent)'}
        </h1>
        <div className="mt-2 flex items-center gap-2 flex-wrap text-sm">
          <span className="font-mono font-semibold">
            {formatDuration(duration)}
          </span>
          <Badge variant="secondary">
            {totalTokens.toLocaleString()} tokens
          </Badge>
          {toolCallCount > 0 && (
            <Badge variant="outline">
              {toolCallCount} tool call{toolCallCount === 1 ? '' : 's'}
            </Badge>
          )}
          {startedAt != null && (
            <span className="text-xs text-muted-foreground">
              {new Date(startedAt).toLocaleString()}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground font-mono truncate">
          {traceId}
        </p>
      </div>

      <div className="flex-1 overflow-auto w-full px-4 md:px-8 py-4 md:py-6">
        <section className="rounded-lg border">
          <div className="border-b px-4 py-2.5 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Spans
            </h2>
            <span className="text-xs text-muted-foreground">
              {spans.length} span{spans.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="p-3">
            <AgentTraceWaterfall spans={spans} />
          </div>
        </section>
      </div>
    </div>
  );
}
