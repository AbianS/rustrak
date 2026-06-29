'use client';

import type { CheckIn, Monitor } from '@rustrak/client';
import { format, formatDistanceToNow } from 'date-fns';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Fragment, useCallback, useState } from 'react';
import { listCheckIns } from '@/actions/monitors';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface MonitorsListProps {
  projectId: number;
  monitors: Monitor[];
}

/** Tailwind classes for a monitor/check-in status badge. */
function statusTone(status: string): string {
  switch (status) {
    case 'ok':
      return 'border-primary/30 bg-primary/10 text-primary';
    case 'error':
    case 'timeout':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    case 'missed':
      return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500';
    case 'in_progress':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400';
    default:
      return 'border-muted-foreground/20 bg-muted text-muted-foreground';
  }
}

/** Human-readable one-liner for a monitor's schedule. */
function scheduleLabel(monitor: Monitor): string {
  if (monitor.schedule_type === 'crontab' && monitor.schedule_value) {
    return monitor.schedule_value;
  }
  if (monitor.schedule_type === 'interval' && monitor.schedule_value) {
    const unit = monitor.schedule_unit ?? 'interval';
    const plural = monitor.schedule_value === '1' ? unit : `${unit}s`;
    return `every ${monitor.schedule_value} ${plural}`;
  }
  return '—';
}

function relativeOrDash(value: string | null): string {
  if (!value) return '—';
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

export function MonitorsList({ projectId, monitors }: MonitorsListProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [checkInsBySlug, setCheckInsBySlug] = useState<
    Record<string, CheckIn[]>
  >({});
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  const toggle = useCallback(
    async (slug: string) => {
      if (expanded === slug) {
        setExpanded(null);
        return;
      }
      setExpanded(slug);
      if (!checkInsBySlug[slug]) {
        setLoadingSlug(slug);
        try {
          const page = await listCheckIns(projectId, slug, { per_page: 10 });
          setCheckInsBySlug((prev) => ({ ...prev, [slug]: page.items }));
        } finally {
          setLoadingSlug(null);
        }
      }
    },
    [expanded, checkInsBySlug, projectId],
  );

  return (
    <div className="h-full rounded-lg border overflow-hidden *:data-[slot=table-container]:h-full">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-8" />
            <TableHead className="w-24">Status</TableHead>
            <TableHead>Monitor</TableHead>
            <TableHead className="hidden md:table-cell">Schedule</TableHead>
            <TableHead className="hidden lg:table-cell w-40 text-right">
              Last check-in
            </TableHead>
            <TableHead className="w-40 text-right">Next expected</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {monitors.map((monitor) => {
            const isOpen = expanded === monitor.slug;
            const checkIns = checkInsBySlug[monitor.slug];
            return (
              <Fragment key={monitor.id}>
                <TableRow
                  onClick={() => toggle(monitor.slug)}
                  aria-expanded={isOpen}
                  className={cn(
                    'cursor-pointer',
                    isOpen && 'bg-muted/40 hover:bg-muted/40',
                  )}
                >
                  <TableCell className="py-2 text-muted-foreground">
                    <ChevronRight
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
                        statusTone(monitor.status),
                      )}
                    >
                      {monitor.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 max-w-0">
                    <span className="block truncate font-medium text-sm">
                      {monitor.slug}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell py-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {scheduleLabel(monitor)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell py-2 text-right">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {relativeOrDash(monitor.last_check_in_at)}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {relativeOrDash(monitor.next_expected_at)}
                    </span>
                  </TableCell>
                </TableRow>

                {isOpen && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="bg-muted/20 p-0">
                      <div className="px-5 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                          Recent check-ins
                        </p>
                        {loadingSlug === monitor.slug ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            Loading…
                          </div>
                        ) : checkIns && checkIns.length > 0 ? (
                          <div className="grid gap-px overflow-hidden rounded-md border bg-border">
                            {checkIns.map((ci) => (
                              <div
                                key={ci.id}
                                className="grid grid-cols-[6rem_1fr_auto] items-center gap-3 bg-background px-3 py-1.5"
                              >
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'justify-center text-[10px] uppercase tracking-wide',
                                    statusTone(ci.status),
                                  )}
                                >
                                  {ci.status}
                                </Badge>
                                <span className="font-mono text-xs text-muted-foreground">
                                  {ci.duration !== null
                                    ? `${ci.duration.toFixed(1)}s`
                                    : '—'}
                                  {ci.environment ? ` · ${ci.environment}` : ''}
                                </span>
                                <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                                  {format(new Date(ci.timestamp), 'PPpp')}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No check-ins recorded yet.
                          </p>
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
  );
}
