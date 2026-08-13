import { Bot } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
  getAgentDuration,
  getAgentEnvironments,
  getAgentModelsByCalls,
  getAgentModelsByTokens,
  getAgentModelsTable,
  getAgentRuns,
  getAgentSummary,
  getAgentTools,
  getAgentToolsTable,
  getAgentTraces,
} from '@/features/agent-trace/api/queries';
import { resolveAgentFilters } from '@/features/agent-trace/model/filters';
import { AgentBreakdownChart } from '@/features/agent-trace/ui/components/agent-breakdown-chart';
import { AgentDashboardFilters } from '@/features/agent-trace/ui/components/agent-dashboard-filters';
import { AgentDurationChart } from '@/features/agent-trace/ui/components/agent-duration-chart';
import { AgentModelsTable } from '@/features/agent-trace/ui/components/agent-models-table';
import { AgentSummaryTiles } from '@/features/agent-trace/ui/components/agent-summary-tiles';
import { AgentTimeseriesChart } from '@/features/agent-trace/ui/components/agent-timeseries-chart';
import { AgentToolsTable } from '@/features/agent-trace/ui/components/agent-tools-table';
import { AgentTracesTable } from '@/features/agent-trace/ui/components/agent-traces-table';
import { getProject } from '@/features/project/api/queries';
import { loadAll } from '@/shared/lib/results';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/components/shadcn/card';

interface AgentsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string;
    period?: string;
    environment?: string;
  }>;
}

export async function generateMetadata({
  params,
}: AgentsPageProps): Promise<Metadata> {
  const t = await getTranslations('projectPages');
  const { id } = await params;
  const project = await getProject(parseInt(id, 10));

  if (!project.success) {
    return { title: t('projectNotFound') };
  }

  return {
    title: t('agents.meta.title', { project: project.data.name }),
    description: t('agents.meta.description', { project: project.data.name }),
  };
}

export default async function AgentsPage({
  params,
  searchParams,
}: AgentsPageProps) {
  const t = await getTranslations('projectPages');
  const { id } = await params;
  const { page = '1', period, environment } = await searchParams;
  const projectId = parseInt(id, 10);
  const currentPage = Math.max(1, parseInt(page, 10) || 1);

  // One window for every widget on the page: a chart on 24h beside a table on
  // all-time is a reader's trap, not a feature.
  const filters = resolveAgentFilters({ period, environment });
  const series = {
    period_hours: filters.periodHours,
    interval_hours: filters.intervalHours,
    environment: filters.environment,
  };
  const breakdown = {
    period_hours: filters.periodHours,
    environment: filters.environment,
  };

  const projectResult = await getProject(projectId);

  if (!projectResult.success) {
    return (
      <LoadFailure error={projectResult.error} title={t('loadProjectFailed')} />
    );
  }

  const project = projectResult.data;

  // Nothing is swallowed: a fetch/auth failure renders an outage surface rather
  // than the "no agent activity yet" onboarding state, which would tell a team
  // whose agents are running that they never instrumented anything.
  const loaded = await loadAll([
    getAgentRuns(projectId, series),
    getAgentDuration(projectId, series),
    getAgentModelsByCalls(projectId, breakdown),
    getAgentModelsByTokens(projectId, breakdown),
    getAgentTools(projectId, breakdown),
    getAgentTraces(projectId, {
      page: currentPage,
      per_page: 20,
      period_hours: filters.periodHours,
      environment: filters.environment,
    }),
    getAgentSummary(projectId, breakdown),
    getAgentModelsTable(projectId, breakdown),
    getAgentToolsTable(projectId, breakdown),
    // Not filtered by the current environment: the picker has to keep
    // offering the option you would switch back to.
    getAgentEnvironments(projectId),
  ]);

  if (!loaded.success) {
    return (
      <LoadFailure
        error={loaded.error}
        title={t('agents.loadFailed')}
        notFoundOnMissing={false}
      />
    );
  }

  const [
    runs,
    duration,
    modelsByCalls,
    modelsByTokens,
    tools,
    traces,
    summary,
    modelRows,
    toolRows,
    environments,
  ] = loaded.data;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="shrink-0 w-full px-4 md:px-8 py-4 md:py-6 border-b">
        <h1 className="text-lg font-semibold">{t('agents.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('agents.subtitle', { project: project.name })}
        </p>
        <div className="mt-3">
          <AgentDashboardFilters
            projectId={projectId}
            current={{ period, environment }}
            environments={environments}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto w-full px-4 md:px-8 py-4 md:py-6">
        {traces.total_count === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-full text-center">
            <Bot className="size-12 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold mb-1">
              {t('agents.emptyTitle')}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              {t('agents.emptyDescription')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <AgentSummaryTiles summary={summary} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card size="sm">
                <CardHeader>
                  <CardTitle>{t('agents.cardRuns')}</CardTitle>
                  <CardDescription>
                    {t('agents.cardRunsDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AgentTimeseriesChart points={runs} />
                </CardContent>
              </Card>

              <Card size="sm">
                <CardHeader>
                  <CardTitle>{t('agents.cardDuration')}</CardTitle>
                  <CardDescription>
                    {t('agents.cardDurationDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AgentDurationChart points={duration} />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card size="sm">
                <CardHeader>
                  <CardTitle>{t('agents.cardModelsByCalls')}</CardTitle>
                  <CardDescription>
                    {t('agents.cardModelsByCallsDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AgentBreakdownChart rows={modelsByCalls} />
                </CardContent>
              </Card>

              <Card size="sm">
                <CardHeader>
                  <CardTitle>{t('agents.cardModelsByTokens')}</CardTitle>
                  <CardDescription>
                    {t('agents.cardModelsByTokensDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AgentBreakdownChart rows={modelsByTokens} />
                </CardContent>
              </Card>

              <Card size="sm">
                <CardHeader>
                  <CardTitle>{t('agents.cardTools')}</CardTitle>
                  <CardDescription>
                    {t('agents.cardToolsDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AgentBreakdownChart rows={tools} />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card size="sm">
                <CardHeader>
                  <CardTitle>{t('agents.cardModelsTable')}</CardTitle>
                  <CardDescription>
                    {t('agents.cardModelsTableDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AgentModelsTable rows={modelRows} />
                </CardContent>
              </Card>

              <Card size="sm">
                <CardHeader>
                  <CardTitle>{t('agents.cardToolsTable')}</CardTitle>
                  <CardDescription>
                    {t('agents.cardToolsTableDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AgentToolsTable rows={toolRows} />
                </CardContent>
              </Card>
            </div>

            <Card size="sm">
              <CardHeader>
                <CardTitle>{t('agents.cardTraces')}</CardTitle>
                <CardDescription>
                  {t('agents.cardTracesDescription')}
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
                  filters={{ period, environment }}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
