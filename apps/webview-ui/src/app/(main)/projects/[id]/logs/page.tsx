import { ScrollText } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { listLogs } from '@/features/log/api/queries';
import { getProject } from '@/features/project/api/queries';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { LogsList } from '@/features/log/ui/components/logs-list';

interface LogsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; level?: string }>;
}

export async function generateMetadata({
  params,
}: LogsPageProps): Promise<Metadata> {
  const t = await getTranslations('projectPages');
  const { id } = await params;
  const project = await getProject(parseInt(id, 10));

  if (!project.success) {
    return { title: t('projectNotFound') };
  }

  return {
    title: t('logs.meta.title', { project: project.data.name }),
    description: t('logs.meta.description', { project: project.data.name }),
  };
}

export default async function LogsPage({
  params,
  searchParams,
}: LogsPageProps) {
  const t = await getTranslations('projectPages');
  const { id } = await params;
  const { page = '1', level } = await searchParams;
  const projectId = parseInt(id, 10);
  const currentPage = Math.max(1, parseInt(page, 10) || 1);

  const projectResult = await getProject(projectId);

  if (!projectResult.success) {
    return (
      <LoadFailure error={projectResult.error} title={t('loadProjectFailed')} />
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
        title={t('logs.loadFailed')}
        notFoundOnMissing={false}
      />
    );
  }

  const logs = logsResult.data;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="shrink-0 w-full px-4 md:px-8 py-4 md:py-6 border-b">
        <h1 className="text-lg font-semibold">{t('logs.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('logs.subtitle', { project: project.name })}
        </p>
      </div>

      <div className="flex-1 overflow-hidden w-full px-4 md:px-8 py-4 md:py-6">
        {logs.total_count === 0 && !level ? (
          <div className="flex flex-col items-center justify-center min-h-full text-center">
            <ScrollText className="size-12 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold mb-1">
              {t('logs.emptyTitle')}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              {t.rich('logs.emptyDescription', {
                code: (chunks) => <code>{chunks}</code>,
              })}
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
