'use client';

import type { OffsetPaginatedResponse, Transaction } from '@rustrak/client';
import { formatDistanceToNow } from 'date-fns';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/components/shadcn/badge';
import { Button } from '@/shared/ui/components/shadcn/button';

interface TransactionsListProps {
  projectId: number;
  initialTransactions: OffsetPaginatedResponse<Transaction>;
  currentPage: number;
  /** Base path for pagination links (defaults to the performance landing). */
  basePath?: string;
  filters?: {
    name?: string;
    op?: string;
    status?: string;
    environment?: string;
    release?: string;
  };
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function durationTone(ms: number | null): {
  text: string;
  bar: string;
  pct: number;
} {
  if (ms === null)
    return { text: 'text-muted-foreground', bar: 'bg-muted', pct: 0 };
  if (ms > 3000)
    return { text: 'text-destructive', bar: 'bg-destructive', pct: 100 };
  if (ms > 1000)
    return {
      text: 'text-yellow-600 dark:text-yellow-500',
      bar: 'bg-yellow-500',
      pct: Math.min(100, (ms / 3000) * 100),
    };
  return {
    text: 'text-primary',
    bar: 'bg-primary',
    pct: Math.min(100, (ms / 3000) * 100),
  };
}

export function TransactionsList({
  projectId,
  initialTransactions,
  currentPage,
  basePath,
  filters,
}: TransactionsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const path = basePath ?? `/projects/${projectId}/performance`;

  const {
    items: transactions,
    total_count,
    total_pages,
    per_page,
  } = initialTransactions;

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    // Preserve active filters across pagination so the page stays in context.
    if (filters?.name) params.set('name', filters.name);
    if (filters?.op) params.set('op', filters.op);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.environment) params.set('environment', filters.environment);
    if (filters?.release) params.set('release', filters.release);
    startTransition(() => {
      router.push(`${path}?${params.toString()}`);
    });
  };

  const startIndex = (currentPage - 1) * per_page + 1;
  const endIndex = Math.min(currentPage * per_page, total_count);

  if (transactions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <Zap className="size-12 text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-semibold mb-1">No transactions yet</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Configure your SDK with <code>tracesSampleRate</code> to start
          capturing performance data.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden flex flex-col border rounded-lg">
        <div className="shrink-0 flex items-center gap-4 px-4 py-3 bg-muted/50 border-b">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex-1">
            Transaction
          </span>
          <span className="hidden sm:block text-xs font-bold uppercase tracking-widest text-muted-foreground w-40">
            Duration
          </span>
          <span className="hidden md:block text-xs font-bold uppercase tracking-widest text-muted-foreground w-28 text-right">
            Last Seen
          </span>
        </div>

        <div className="flex-1 overflow-auto divide-y">
          {transactions.map((txn) => {
            const tone = durationTone(txn.duration_ms);
            return (
              <Link
                key={txn.id}
                href={`/projects/${projectId}/performance/${txn.id}`}
                className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <span className="block font-mono text-sm truncate group-hover:text-primary transition-colors">
                    {txn.transaction_name || '(unnamed)'}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mt-1">
                    {txn.platform && (
                      <Badge variant="outline" className="text-[10px]">
                        {txn.platform}
                      </Badge>
                    )}
                    {txn.environment && (
                      <Badge variant="secondary" className="text-[10px]">
                        {txn.environment}
                      </Badge>
                    )}
                    {txn.release && (
                      <span className="font-mono truncate max-w-40">
                        {txn.release}
                      </span>
                    )}
                    <span className={cn('sm:hidden font-medium', tone.text)}>
                      {formatDuration(txn.duration_ms)}
                    </span>
                  </div>
                </div>

                <div className="hidden sm:flex flex-col items-end w-40 gap-1">
                  <span
                    className={cn('font-mono text-sm font-medium', tone.text)}
                  >
                    {formatDuration(txn.duration_ms)}
                  </span>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', tone.bar)}
                      style={{ width: `${tone.pct}%` }}
                    />
                  </div>
                </div>

                <div className="hidden md:block w-28 text-right">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(txn.timestamp), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {total_pages > 0 && (
        <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2 pt-4">
          <span className="text-sm text-muted-foreground">
            {total_count > 0
              ? `Showing ${startIndex}-${endIndex} of ${total_count}`
              : 'No results'}
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-label="Go to previous page"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isPending}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>

            <span className="text-sm px-2">
              Page {currentPage} of {total_pages}
            </span>

            <Button
              variant="outline"
              size="sm"
              aria-label="Go to next page"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= total_pages || isPending}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
