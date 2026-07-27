import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProject } from '@/actions/projects';
import {
  getTransactionStatForGroup,
  listTransactions,
} from '@/actions/transactions';
import { LoadFailure } from '@/components/load-failure';
import { Badge } from '@/components/ui/badge';
import { loadAll } from '@/lib/results';
import { TransactionsList } from '../transactions-list';

interface SummaryPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ name?: string; op?: string; page?: string }>;
}

export async function generateMetadata({
  searchParams,
}: SummaryPageProps): Promise<Metadata> {
  const { name } = await searchParams;
  return { title: `${name ?? 'Transaction'} | Performance | Rustrak` };
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default async function TransactionSummaryPage({
  params,
  searchParams,
}: SummaryPageProps) {
  const { id } = await params;
  const { name, op, page = '1' } = await searchParams;
  const projectId = parseInt(id, 10);
  const currentPage = Math.max(1, parseInt(page, 10) || 1);

  if (!name) {
    notFound();
  }

  const filters = { name, op };

  // Direct group lookup — correct regardless of how many groups exist (no
  // "fetch page 1 and hope the group is on it"). `getTransactionStatForGroup`
  // already turns "this group has no rows" into a successful `null`, so a
  // failure here is a real one.
  const loaded = await loadAll([
    getProject(projectId),
    listTransactions(projectId, {
      page: currentPage,
      per_page: 20,
      ...filters,
    }),
    getTransactionStatForGroup(projectId, name, op),
  ]);

  if (!loaded.success) {
    return (
      <LoadFailure error={loaded.error} title="Could not load transaction" />
    );
  }

  const [, samples, group] = loaded.data;

  const metrics: { label: string; value: string }[] = group
    ? [
        { label: 'Count', value: group.count.toLocaleString() },
        { label: 'p50', value: formatMs(group.p50_ms) },
        { label: 'p95', value: formatMs(group.p95_ms) },
        { label: 'p99', value: formatMs(group.p99_ms) },
        {
          label: 'Failure rate',
          value: `${(group.failure_rate * 100).toFixed(1)}%`,
        },
      ]
    : [];

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="shrink-0 w-full px-4 md:px-8 py-4 md:py-6 border-b">
        <Link
          href={`/projects/${projectId}/performance`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="size-4" />
          Performance
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-mono text-lg font-semibold break-all">{name}</h1>
          {op && <Badge variant="secondary">{op}</Badge>}
        </div>

        {metrics.length > 0 && (
          <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
            {metrics.map((m) => (
              <div key={m.label}>
                <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {m.label}
                </dt>
                <dd className="font-mono text-sm font-semibold tabular-nums">
                  {m.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="flex-1 overflow-hidden w-full px-4 md:px-8 py-4 md:py-6 flex flex-col gap-3">
        <h2 className="shrink-0 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Samples
        </h2>
        <TransactionsList
          projectId={projectId}
          initialTransactions={samples}
          currentPage={currentPage}
          basePath={`/projects/${projectId}/performance/summary`}
          filters={filters}
        />
      </div>
    </div>
  );
}
