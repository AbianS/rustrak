import { Zap } from 'lucide-react';
import type { Metadata } from 'next';
import { LoadFailure } from '@/components/load-failure';
import { getProject } from '@/features/project/api/queries';
import { getTransactionStats } from '@/features/transaction/api/queries';
import { TransactionStatsTable } from './transaction-stats-table';

interface PerformancePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({
  params,
}: PerformancePageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(parseInt(id, 10));

  if (!project.success) {
    return { title: 'Project Not Found | Rustrak' };
  }

  return {
    title: `Performance | ${project.data.name} | Rustrak`,
    description: `Transaction performance for ${project.data.name}`,
  };
}

export default async function PerformancePage({
  params,
  searchParams,
}: PerformancePageProps) {
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
  // than the "no transactions yet" onboarding state.
  const statsResult = await getTransactionStats(projectId, {
    page: currentPage,
    per_page: 20,
  });

  if (!statsResult.success) {
    return (
      <LoadFailure
        error={statsResult.error}
        title="Could not load transactions"
        notFoundOnMissing={false}
      />
    );
  }

  const stats = statsResult.data;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="shrink-0 w-full px-4 md:px-8 py-4 md:py-6 border-b">
        <h1 className="text-lg font-semibold">Performance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Transactions for {project.name}, grouped by name and operation
        </p>
      </div>

      <div className="flex-1 overflow-hidden w-full px-4 md:px-8 py-4 md:py-6">
        {stats.total_count === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-full text-center">
            <Zap className="size-12 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold mb-1">No transactions yet</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Configure your SDK with <code>tracesSampleRate</code> to start
              capturing performance data.
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
