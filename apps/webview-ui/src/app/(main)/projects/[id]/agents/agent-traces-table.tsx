'use client';

import type { AgentTraceSummary } from '@rustrak/client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AgentTracesTableProps {
  projectId: number;
  traces: AgentTraceSummary[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  perPage: number;
}

function formatMs(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * The AI Agent Monitoring "Traces" table: one row per trace_id, aggregating
 * every AI span in that trace regardless of origin (standalone or
 * transaction-embedded). Same offset-pagination shape and flex-div list
 * pattern as `TransactionStatsTable` for visual consistency.
 */
export function AgentTracesTable({
  projectId,
  traces,
  currentPage,
  totalPages,
  totalCount,
  perPage,
}: AgentTracesTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handlePageChange = (page: number) => {
    startTransition(() => {
      router.push(`/projects/${projectId}/agents?page=${page}`);
    });
  };

  const startIndex = (currentPage - 1) * perPage + 1;
  const endIndex = Math.min(currentPage * perPage, totalCount);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden flex flex-col border rounded-lg">
        <div className="shrink-0 flex items-center gap-4 px-4 py-3 bg-muted/50 border-b text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <span className="flex-1">Agents</span>
          <span className="w-24 text-right">Duration</span>
          <span className="w-20 text-right">Tokens</span>
          <span className="w-16 text-right">Tools</span>
        </div>
        <div className="flex-1 overflow-auto divide-y">
          {traces.map((t) => (
            <Link
              key={t.trace_id}
              href={`/projects/${projectId}/agents/${t.trace_id}`}
              className="flex items-center gap-4 px-4 py-3 text-sm hover:bg-muted/30 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                {t.agent_names.length > 0 ? (
                  <span className="flex flex-wrap items-center gap-1">
                    {t.agent_names.map((name) => (
                      <Badge
                        key={name}
                        variant="secondary"
                        className="font-mono font-normal"
                      >
                        {name}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  <span className="block font-mono truncate text-muted-foreground">
                    (unnamed agent)
                  </span>
                )}
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {t.trace_id}
                </span>
              </div>
              <span className="w-24 text-right font-mono tabular-nums text-muted-foreground">
                {formatMs(t.duration_ms)}
              </span>
              <span className="w-20 text-right font-mono tabular-nums text-muted-foreground">
                {t.total_tokens.toLocaleString()}
              </span>
              <span className="w-16 text-right font-mono tabular-nums text-muted-foreground">
                {t.tool_call_count.toLocaleString()}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {totalPages > 0 && (
        <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2 pt-4">
          <span className="text-sm text-muted-foreground">
            {`Showing ${startIndex}-${endIndex} of ${totalCount}`}
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
              Page {currentPage} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              aria-label="Go to next page"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isPending}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
