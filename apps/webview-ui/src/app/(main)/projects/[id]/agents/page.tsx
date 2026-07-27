import { Bot } from 'lucide-react';
import type { Metadata } from 'next';
import {
  getAgentDuration,
  getAgentModelsByCalls,
  getAgentModelsByTokens,
  getAgentRuns,
  getAgentTools,
  getAgentTraces,
} from '@/actions/agents';
import { getProject } from '@/actions/projects';
import { LoadFailure } from '@/components/load-failure';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { loadAll } from '@/lib/results';
import { AgentBreakdownChart } from './agent-breakdown-chart';
import { AgentDurationChart } from './agent-duration-chart';
import { AgentTimeseriesChart } from './agent-timeseries-chart';
import { AgentTracesTable } from './agent-traces-table';

interface AgentsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({
  params,
}: AgentsPageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(parseInt(id, 10));

  if (!project.success) {
    return { title: 'Project Not Found | Rustrak' };
  }

  return {
    title: `Agents | ${project.data.name} | Rustrak`,
    description: `AI agent monitoring for ${project.data.name}`,
  };
}

export default async function AgentsPage({
  params,
  searchParams,
}: AgentsPageProps) {
  const { id } = await params;
  const { page = '1' } = await searchParams;
  const projectId = parseInt(id, 10);
  const currentPage = Math.max(1, parseInt(page, 10) || 1);

  const projectResult = await getProject(projectId);

  if (!projectResult.success) {
    return (
      <LoadFailure error={projectResult.error} title="Could not load project" />
    );
  }

  const project = projectResult.data;

  // Nothing is swallowed: a fetch/auth failure renders an outage surface rather
  // than the "no agent activity yet" onboarding state, which would tell a team
  // whose agents are running that they never instrumented anything.
  const loaded = await loadAll([
    getAgentRuns(projectId),
    getAgentDuration(projectId),
    getAgentModelsByCalls(projectId),
    getAgentModelsByTokens(projectId),
    getAgentTools(projectId),
    getAgentTraces(projectId, { page: currentPage, per_page: 20 }),
  ]);

  if (!loaded.success) {
    return (
      <LoadFailure
        error={loaded.error}
        title="Could not load agent activity"
        notFoundOnMissing={false}
      />
    );
  }

  const [runs, duration, modelsByCalls, modelsByTokens, tools, traces] =
    loaded.data;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="shrink-0 w-full px-4 md:px-8 py-4 md:py-6 border-b">
        <h1 className="text-lg font-semibold">Agents</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          AI agent runs, tokens, and tool usage for {project.name}
        </p>
      </div>

      <div className="flex-1 overflow-auto w-full px-4 md:px-8 py-4 md:py-6">
        {traces.total_count === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-full text-center">
            <Bot className="size-12 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold mb-1">
              No agent activity yet
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Instrument your AI agent with a Sentry SDK using OpenTelemetry
              GenAI semantic conventions to start capturing agent runs.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card size="sm">
                <CardHeader>
                  <CardTitle>Agent Runs</CardTitle>
                  <CardDescription>Runs started per interval</CardDescription>
                </CardHeader>
                <CardContent>
                  <AgentTimeseriesChart points={runs} />
                </CardContent>
              </Card>

              <Card size="sm">
                <CardHeader>
                  <CardTitle>Duration</CardTitle>
                  <CardDescription>Avg and p95 agent run time</CardDescription>
                </CardHeader>
                <CardContent>
                  <AgentDurationChart points={duration} />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card size="sm">
                <CardHeader>
                  <CardTitle>LLM Calls by Model</CardTitle>
                  <CardDescription>Top models by call count</CardDescription>
                </CardHeader>
                <CardContent>
                  <AgentBreakdownChart rows={modelsByCalls} />
                </CardContent>
              </Card>

              <Card size="sm">
                <CardHeader>
                  <CardTitle>Tokens Used by Model</CardTitle>
                  <CardDescription>Top models by token volume</CardDescription>
                </CardHeader>
                <CardContent>
                  <AgentBreakdownChart rows={modelsByTokens} />
                </CardContent>
              </Card>

              <Card size="sm">
                <CardHeader>
                  <CardTitle>Tool Calls by Tool</CardTitle>
                  <CardDescription>Top tools by call count</CardDescription>
                </CardHeader>
                <CardContent>
                  <AgentBreakdownChart rows={tools} />
                </CardContent>
              </Card>
            </div>

            <Card size="sm">
              <CardHeader>
                <CardTitle>Traces</CardTitle>
                <CardDescription>
                  One row per trace, aggregating every AI span it contains
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AgentTracesTable
                  projectId={projectId}
                  traces={traces.items}
                  currentPage={Math.min(
                    currentPage,
                    Math.max(1, traces.total_pages),
                  )}
                  totalPages={traces.total_pages}
                  totalCount={traces.total_count}
                  perPage={traces.per_page}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
