import { ScrollText } from 'lucide-react';
import type { Metadata } from 'next';
import { listLogs } from '@/features/log/api/queries';
import { getProject } from '@/features/project/api/queries';
import { LoadFailure } from '@/components/load-failure';
import { LogsList } from './logs-list';

interface LogsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; level?: string }>;
}

export async function generateMetadata({
  params,
}: LogsPageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(parseInt(id, 10));

  if (!project.success) {
    return { title: 'Project Not Found | Rustrak' };
  }

  return {
    title: `Logs | ${project.data.name} | Rustrak`,
    description: `Structured logs for ${project.data.name}`,
  };
}

export default async function LogsPage({
  params,
  searchParams,
}: LogsPageProps) {
  const { id } = await params;
  const { page = '1', level } = await searchParams;
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
  // than the "no logs yet" onboarding state.
  const logsResult = await listLogs(projectId, {
    page: currentPage,
    per_page: 50,
    level: level || undefined,
  });

  if (!logsResult.success) {
    return (
      <LoadFailure
        error={logsResult.error}
        title="Could not load logs"
        notFoundOnMissing={false}
      />
    );
  }

  const logs = logsResult.data;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="shrink-0 w-full px-4 md:px-8 py-4 md:py-6 border-b">
        <h1 className="text-lg font-semibold">Logs</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Structured logs for {project.name}, newest first
        </p>
      </div>

      <div className="flex-1 overflow-hidden w-full px-4 md:px-8 py-4 md:py-6">
        {logs.total_count === 0 && !level ? (
          <div className="flex flex-col items-center justify-center min-h-full text-center">
            <ScrollText className="size-12 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold mb-1">No logs yet</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Send structured logs from your SDK (e.g.{' '}
              <code>Sentry.logger.info(...)</code>) to start collecting them
              here.
            </p>
          </div>
        ) : (
          <LogsList
            projectId={projectId}
            initialLogs={logs}
            currentPage={currentPage}
            activeLevel={level}
          />
        )}
      </div>
    </div>
  );
}
