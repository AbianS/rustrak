'use client';

import type { Log, OffsetPaginatedResponse } from '@rustrak/client';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightSmall,
  ScrollText,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Fragment, useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
      return 'border-destructive/40 bg-destructive/15 text-destructive';
    case 'error':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    case 'warn':
      return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500';
    case 'info':
      return 'border-primary/30 bg-primary/10 text-primary';
    case 'debug':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400';
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
  const { items: logs, total_count, total_pages, per_page } = initialLogs;

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
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const startIndex = (currentPage - 1) * per_page + 1;
  const endIndex = Math.min(currentPage * per_page, total_count);

  return (
    <div className="flex flex-col h-full">
        {/* Filter bar */}
        <div className="shrink-0 flex items-center justify-between gap-3 pb-3 flex-wrap">
          <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
            <Button
              variant={!activeLevel ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-3"
              onClick={() => navigate(1)}
              disabled={isPending}
            >
              All
            </Button>
            {LEVELS.map((lvl) => (
              <Button
                key={lvl}
                variant={activeLevel === lvl ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-3 capitalize"
                onClick={() => navigate(1, lvl)}
                disabled={isPending}
              >
                {lvl}
              </Button>
            ))}
          </div>
          {total_count > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {startIndex}–{endIndex} of {total_count.toLocaleString()}
            </span>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center rounded-lg border border-dashed">
            <ScrollText className="size-12 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold mb-1">
              No logs match this filter
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Try a different level or clear the filter.
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 rounded-lg border overflow-hidden *:data-[slot=table-container]:h-full">
            {/* The table's own wrapper (data-slot=table-container) is the
                scroll container; the *:data-[slot=table-container]:h-full
                variant bounds its height so the sticky header anchors to it,
                leaving table.tsx untouched. */}
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-8" />
                  <TableHead className="w-20">Level</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="hidden md:table-cell w-36">
                    Trace
                  </TableHead>
                  <TableHead className="w-32 text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const isOpen = expanded.has(log.id);
                  const attributes = Object.entries(log.attributes ?? {});
                  return (
                    <Fragment key={log.id}>
                      <TableRow
                        onClick={() => toggleExpanded(log.id)}
                        aria-expanded={isOpen}
                        className={cn(
                          'cursor-pointer',
                          isOpen && 'bg-muted/40 hover:bg-muted/40',
                        )}
                      >
                        <TableCell className="py-2 text-muted-foreground">
                          <ChevronRightSmall
                            className={cn(
                              'size-4 transition-transform',
                              isOpen && 'rotate-90',
                            )}
                            aria-hidden="true"
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              'w-full justify-center text-[10px] uppercase tracking-wide',
                              levelTone(log.level),
                            )}
                          >
                            {log.level}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 max-w-0">
                          <span className="block truncate font-mono text-sm">
                            {log.body || '(empty)'}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell py-2">
                          {log.trace_id ? (
                            <span className="font-mono text-xs text-muted-foreground">
                              {log.trace_id.slice(0, 8)}…
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(log.timestamp), {
                              addSuffix: true,
                            })}
                          </span>
                        </TableCell>
                      </TableRow>

                      {isOpen && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={5} className="bg-muted/20 p-0">
                            <div className="px-5 py-4 space-y-4">
                              <dl className="grid grid-cols-[5.5rem_1fr] gap-x-4 gap-y-1.5 text-sm">
                                <dt className="text-muted-foreground">
                                  timestamp
                                </dt>
                                <dd className="font-mono text-xs">
                                  {format(new Date(log.timestamp), 'PPpp')}
                                </dd>
                                {log.trace_id && (
                                  <>
                                    <dt className="text-muted-foreground">
                                      trace_id
                                    </dt>
                                    <dd className="font-mono text-xs break-all">
                                      {log.trace_id}
                                    </dd>
                                  </>
                                )}
                                {log.span_id && (
                                  <>
                                    <dt className="text-muted-foreground">
                                      span_id
                                    </dt>
                                    <dd className="font-mono text-xs break-all">
                                      {log.span_id}
                                    </dd>
                                  </>
                                )}
                                {log.severity_number !== null && (
                                  <>
                                    <dt className="text-muted-foreground">
                                      severity
                                    </dt>
                                    <dd className="font-mono text-xs">
                                      {log.severity_number}
                                    </dd>
                                  </>
                                )}
                              </dl>

                              {attributes.length > 0 && (
                                <div>
                                  <Separator className="mb-3" />
                                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                                    Attributes
                                  </p>
                                  <div className="grid gap-px overflow-hidden rounded-md border bg-border">
                                    {attributes.map(([key, raw]) => {
                                      const { value, type } =
                                        attributeDisplay(raw);
                                      return (
                                        <div
                                          key={key}
                                          className="grid grid-cols-[12rem_1fr_auto] items-start gap-3 bg-background px-3 py-1.5"
                                        >
                                          <span className="font-mono text-xs text-muted-foreground truncate">
                                            {key}
                                          </span>
                                          <span className="font-mono text-xs break-all">
                                            {value}
                                          </span>
                                          {type && (
                                            <Badge
                                              variant="secondary"
                                              className="text-[10px]"
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
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {total_pages > 0 && (
          <div className="shrink-0 flex items-center justify-end gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              aria-label="Go to previous page"
              onClick={() => navigate(currentPage - 1, activeLevel)}
              disabled={currentPage <= 1 || isPending}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <span className="text-sm px-1 tabular-nums">
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
        )}
    </div>
  );
}
