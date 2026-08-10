import { Zap } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getProject } from '@/features/project/api/queries';
import { getTransactionStats } from '@/features/transaction/api/queries';
import { TransactionStatsTable } from '@/features/transaction/ui/components/transaction-stats-table';
import { LoadFailure } from '@/shared/ui/components/load-failure';

interface PerformancePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({
  params,
}: PerformancePageProps): Promise<Metadata> {
  const t = await getTranslations('projectPages');
  const { id } = await params;
  const project = await getProject(parseInt(id, 10));

  if (!project.success) {
    return { title: t('projectNotFound') };
  }

  return {
    title: t('performance.meta.title', { project: project.data.name }),
    description: t('performance.meta.description', {
      project: project.data.name,
    }),
  };
}

export default async function PerformancePage({
  params,
  searchParams,
}: PerformancePageProps) {
  const t = await getTranslations('projectPages');
  const { id } = await params;
  const { page = '1' } = await searchParams;
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
  // than the "no transactions yet" onboarding state.
  const statsResult = await getTransactionStats(projectId, {
    page: currentPage,
    per_page: 20,
  });

  if (!statsResult.success) {
    return (
      <LoadFailure
        error={statsResult.error}
        title={t('performance.loadFailed')}
        notFoundOnMissing={false}
      />
    );
  }

  const stats = statsResult.data;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="shrink-0 w-full px-4 md:px-8 py-4 md:py-6 border-b">
        <h1 className="text-lg font-semibold">{t('performance.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('performance.subtitle', { project: project.name })}
        </p>
      </div>

      <div className="flex-1 overflow-hidden w-full px-4 md:px-8 py-4 md:py-6">
        {stats.total_count === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-full text-center">
            <Zap className="size-12 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold mb-1">
              {t('performance.emptyTitle')}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              {t.rich('performance.emptyDescription', {
                code: (chunks) => <code>{chunks}</code>,
              })}
            </p>
          </div>
        ) : (
          <TransactionStatsTable
            projectId={projectId}
            stats={stats.items}
            currentPage={currentPage}
            totalPages={stats.total_pages}
            totalCount={stats.total_count}
            perPage={stats.per_page}
          />
        )}
      </div>
    </div>
  );
}
