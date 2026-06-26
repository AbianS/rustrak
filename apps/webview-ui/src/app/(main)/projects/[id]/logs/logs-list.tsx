'use client';

import type { Log, OffsetPaginatedResponse } from '@rustrak/client';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ScrollText,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LogsListProps {
  projectId: number;
  initialLogs: OffsetPaginatedResponse<Log>;
  currentPage: number;
  /** Active level filter, if any. */
  activeLevel?: string;
}

/** Severity-ordered levels for the filter bar. */
const LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

/** Tailwind classes for a level badge, keyed by severity. */
function levelTone(level: string): string {
  switch (level) {
    case 'fatal':
    case 'error':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    case 'warn':
      return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500';
    case 'info':
      return 'border-primary/30 bg-primary/10 text-primary';
    default:
      return 'border-muted-foreground/20 bg-muted text-muted-foreground';
  }
}

/**
 * Renders one attribute value. Logs carry the OTel-style typed map
 * (`{ value, type }`); fall back to a JSON dump for anything else.
 */
function attributeDisplay(raw: unknown): { value: string; type?: string } {
  if (raw !== null && typeof raw === 'object' && 'value' in raw) {
    const entry = raw as { value: unknown; type?: string };
    return { value: String(entry.value), type: entry.type };
  }
  return { value: typeof raw === 'string' ? raw : JSON.stringify(raw) };
}

export function LogsList({
  projectId,
  initialLogs,
  currentPage,
  activeLevel,
}: LogsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const path = `/projects/${projectId}/logs`;
  const {
    items: logs,
    total_count,
    total_pages,
    per_page,
  } = initialLogs;

  const navigate = (page: number, level?: string) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (level) params.set('level', level);
    startTransition(() => {
      router.push(`${path}?${params.toString()}`);
    });
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const startIndex = (currentPage - 1) * per_page + 1;
  const endIndex = Math.min(currentPage * per_page, total_count);

  return (
    <div className="flex flex-col h-full">
      {/* Level filter bar */}
      <div className="shrink-0 flex items-center gap-1.5 pb-3 flex-wrap">
        <Button
          variant={!activeLevel ? 'default' : 'outline'}
          size="sm"
          onClick={() => navigate(1)}
          disabled={isPending}
        >
          All
        </Button>
        {LEVELS.map((lvl) => (
          <Button
            key={lvl}
            variant={activeLevel === lvl ? 'default' : 'outline'}
            size="sm"
            className="capitalize"
            onClick={() => navigate(1, lvl)}
            disabled={isPending}
          >
            {lvl}
          </Button>
        ))}
      </div>

      {logs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <ScrollText className="size-12 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold mb-1">No logs match this filter</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Try a different level or clear the filter.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col border rounded-lg">
          <div className="flex-1 overflow-auto divide-y">
            {logs.map((log) => {
              const isOpen = expanded.has(log.id);
              const attributes = Object.entries(log.attributes ?? {});
              return (
                <div key={log.id}>
                  <button
                    type="button"
                    onClick={() => toggleExpanded(log.id)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors group"
                  >
                    <ChevronDown
                      className={cn(
                        'size-4 shrink-0 text-muted-foreground transition-transform',
                        isOpen ? 'rotate-0' : '-rotate-90',
                      )}
                      aria-hidden="true"
                    />
                    <Badge
                      variant="outline"
                      className={cn(
                        'shrink-0 w-14 justify-center text-[10px] uppercase tracking-wide',
                        levelTone(log.level),
                      )}
                    >
                      {log.level}
                    </Badge>
                    <span className="flex-1 min-w-0 truncate font-mono text-sm">
                      {log.body || '(empty)'}
                    </span>
                    {log.trace_id && (
                      <span className="hidden md:block shrink-0 font-mono text-xs text-muted-foreground truncate max-w-32">
                        {log.trace_id}
                      </span>
                    )}
                    <span className="hidden sm:block shrink-0 text-xs text-muted-foreground whitespace-nowrap w-28 text-right">
                      {formatDistanceToNow(new Date(log.timestamp), {
                        addSuffix: true,
                      })}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 bg-muted/20 border-t text-sm">
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 max-w-3xl">
                        <dt className="text-muted-foreground">timestamp</dt>
                        <dd className="font-mono text-xs">
                          {format(new Date(log.timestamp), 'PPpp')}
                        </dd>
                        {log.trace_id && (
                          <>
                            <dt className="text-muted-foreground">trace_id</dt>
                            <dd className="font-mono text-xs break-all">
                              {log.trace_id}
                            </dd>
                          </>
                        )}
                        {log.span_id && (
                          <>
                            <dt className="text-muted-foreground">span_id</dt>
                            <dd className="font-mono text-xs break-all">
                              {log.span_id}
                            </dd>
                          </>
                        )}
                        {log.severity_number !== null && (
                          <>
                            <dt className="text-muted-foreground">severity</dt>
                            <dd className="font-mono text-xs">
                              {log.severity_number}
                            </dd>
                          </>
                        )}
                      </dl>

                      {attributes.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                            Attributes
                          </p>
                          <div className="rounded-md border divide-y bg-background">
                            {attributes.map(([key, raw]) => {
                              const { value, type } = attributeDisplay(raw);
                              return (
                                <div
                                  key={key}
                                  className="flex items-start gap-3 px-3 py-1.5"
                                >
                                  <span className="font-mono text-xs text-muted-foreground w-48 shrink-0 truncate">
                                    {key}
                                  </span>
                                  <span className="font-mono text-xs flex-1 break-all">
                                    {value}
                                  </span>
                                  {type && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] shrink-0"
                                    >
                                      {type}
                                    </Badge>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              onClick={() => navigate(currentPage - 1, activeLevel)}
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
              onClick={() => navigate(currentPage + 1, activeLevel)}
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
