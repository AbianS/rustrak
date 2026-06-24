import { Zap } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProject } from '@/actions/projects';
import { getTransactionStats } from '@/actions/transactions';
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

  if (!project) {
    return { title: 'Project Not Found | Rustrak' };
  }

  return {
    title: `Performance | ${project.name} | Rustrak`,
    description: `Transaction performance for ${project.name}`,
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

  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  // No catch: a fetch/auth failure must surface to the error boundary, not be
  // disguised as the "no transactions yet" onboarding state.
  const stats = await getTransactionStats(projectId, {
    page: currentPage,
    per_page: 20,
  });

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="shrink-0 max-w-400 w-full mx-auto px-4 md:px-8 py-4 md:py-6 border-b">
        <h1 className="text-lg font-semibold">Performance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Transactions for {project.name}, grouped by name and operation
        </p>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-400 w-full mx-auto px-4 md:px-8 py-4 md:py-6">
          {stats.total_count === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-100 text-center">
              <Zap className="size-12 text-muted-foreground/30 mb-4" />
              <h2 className="text-lg font-semibold mb-1">
                No transactions yet
              </h2>
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
    </div>
  );
}
