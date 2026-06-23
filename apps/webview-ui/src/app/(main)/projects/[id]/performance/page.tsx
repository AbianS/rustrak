import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProject } from '@/actions/projects';
import { listTransactions } from '@/actions/transactions';
import { TransactionsList } from './transactions-list';

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

  const transactions = await listTransactions(projectId, {
    page: currentPage,
    per_page: 20,
  }).catch(() => ({
    items: [],
    total_count: 0,
    page: 1,
    per_page: 20,
    total_pages: 0,
  }));

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="shrink-0 max-w-400 w-full mx-auto px-4 md:px-8 py-4 md:py-6 border-b">
        <h1 className="text-lg font-semibold">Performance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Transaction traces for {project.name}
        </p>
      </div>
      <div className="flex-1 overflow-hidden max-w-400 w-full mx-auto px-4 md:px-8 py-4 md:py-6">
        <TransactionsList
          projectId={projectId}
          initialTransactions={transactions}
          currentPage={currentPage}
        />
      </div>
    </div>
  );
}
