'use client';

import type { PaginatedResponse, Transaction } from '@rustrak/client';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Zap } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { listTransactions } from '@/actions/transactions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TransactionsListProps {
  projectId: number;
  initialTransactions: PaginatedResponse<Transaction>;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// Severity thresholds mirror Sentry's apdex-ish buckets: <1s good, <3s warn.
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
}: TransactionsListProps) {
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<Transaction[]>(initialTransactions.items);
  const [cursor, setCursor] = useState<string | undefined>(
    initialTransactions.next_cursor,
  );
  const [hasMore, setHasMore] = useState<boolean>(initialTransactions.has_more);

  function loadMore() {
    if (!cursor) return;
    startTransition(async () => {
      const next = await listTransactions(projectId, { cursor });
      setItems((prev) => [...prev, ...next.items]);
      setCursor(next.next_cursor);
      setHasMore(next.has_more);
    });
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 text-center">
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
        {/* Header */}
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

        {/* Scrollable rows */}
        <div className="flex-1 overflow-auto">
          {items.map((txn) => {
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
                    {/* Mobile-only duration + time */}
                    <span className={cn('sm:hidden font-medium', tone.text)}>
                      {formatDuration(txn.duration_ms)}
                    </span>
                  </div>
                </div>

                {/* Duration with bar */}
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

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-between gap-2 pt-4">
        <span className="text-sm text-muted-foreground">
          {items.length} transaction{items.length === 1 ? '' : 's'} loaded
        </span>
        {hasMore && (
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Loading…
              </>
            ) : (
              'Load more'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
