'use client';

import type { AgentTraceSummary } from '@rustrak/client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { Link, useRouter } from '@/shared/i18n/navigation';
import { Badge } from '@/shared/ui/components/shadcn/badge';
import { Button } from '@/shared/ui/components/shadcn/button';

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
  const format = useFormatter();
  const t = useTranslations('agents');
  const tableT = useTranslations('table');
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
          <span className="flex-1">{t('columns.agents')}</span>
          <span className="w-24 text-right">{t('columns.duration')}</span>
          <span className="w-20 text-right">{t('columns.tokens')}</span>
          <span className="w-16 text-right">{t('columns.tools')}</span>
        </div>
        <div className="flex-1 overflow-auto divide-y">
          {traces.map((trace) => (
            <Link
              key={trace.trace_id}
              href={`/projects/${projectId}/agents/${trace.trace_id}`}
              className="flex items-center gap-4 px-4 py-3 text-sm hover:bg-muted/30 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                {trace.agent_names.length > 0 ? (
                  <span className="flex flex-wrap items-center gap-1">
                    {trace.agent_names.map((name) => (
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
                    {t('unnamedAgent')}
                  </span>
                )}
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {trace.trace_id}
                </span>
              </div>
              <span className="w-24 text-right font-mono tabular-nums text-muted-foreground">
                {formatMs(trace.duration_ms)}
              </span>
              <span className="w-20 text-right font-mono tabular-nums text-muted-foreground">
                {format.number(trace.total_tokens)}
              </span>
              <span className="w-16 text-right font-mono tabular-nums text-muted-foreground">
                {format.number(trace.tool_call_count)}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {totalPages > 0 && (
        <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2 pt-4">
          <span className="text-sm text-muted-foreground">
            {tableT('showingRange', {
              start: startIndex,
              end: endIndex,
              total: totalCount,
            })}
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-label={tableT('previousPage')}
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isPending}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>

            <span className="text-sm px-2">
              {tableT('pageOf', { current: currentPage, total: totalPages })}
            </span>

            <Button
              variant="outline"
              size="sm"
              aria-label={tableT('nextPage')}
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
