import { format } from 'date-fns';
import {
  Circle,
  CircleAlert,
  Database,
  Globe,
  Info,
  type LucideIcon,
  MousePointerClick,
  Navigation,
  Terminal,
} from 'lucide-react';
import { getSummaryBreadcrumbs } from '@/features/event/lib/breadcrumbs';
import { cn } from '@/shared/lib/utils';
import { BreadcrumbsExpand } from './breadcrumbs-expand';

export interface Breadcrumb {
  timestamp?: number;
  type?: string;
  category?: string;
  message?: string;
  level?: string;
  data?: Record<string, unknown>;
}

export interface GroupedBreadcrumb {
  crumb: Breadcrumb;
  count: number;
}

interface BreadcrumbsProps {
  breadcrumbs?: Breadcrumb[] | { values?: Breadcrumb[] };
}

function normalizeBreadcrumbs(
  breadcrumbs?: Breadcrumb[] | { values?: Breadcrumb[] },
): Breadcrumb[] {
  if (!breadcrumbs) return [];
  if (Array.isArray(breadcrumbs)) return breadcrumbs;
  if ('values' in breadcrumbs && Array.isArray(breadcrumbs.values)) {
    return breadcrumbs.values;
  }
  return [];
}

export function groupConsecutiveBreadcrumbs(
  items: Breadcrumb[],
): GroupedBreadcrumb[] {
  const grouped: GroupedBreadcrumb[] = [];
  for (const crumb of items) {
    const last = grouped[grouped.length - 1];
    if (
      last &&
      last.crumb.category === crumb.category &&
      last.crumb.message === crumb.message &&
      last.crumb.level === crumb.level &&
      last.crumb.type === crumb.type &&
      !crumb.data &&
      !last.crumb.data
    ) {
      last.count++;
    } else {
      grouped.push({ crumb, count: 1 });
    }
  }
  return grouped;
}

/** Pick a timeline icon from the crumb category/type. */
function crumbIcon(crumb: Breadcrumb): LucideIcon {
  const c = `${crumb.category ?? ''} ${crumb.type ?? ''}`.toLowerCase();
  if (c.includes('navigation')) return Navigation;
  if (/http|xhr|fetch|request/.test(c)) return Globe;
  if (/console|debug/.test(c)) return Terminal;
  if (/ui|click|touch/.test(c)) return MousePointerClick;
  if (/query|sql|\bdb\b/.test(c)) return Database;
  if (crumb.level === 'error' || /error|exception/.test(c)) return CircleAlert;
  if (c.includes('info')) return Info;
  return Circle;
}

function levelColor(level?: string): string {
  switch (level) {
    case 'fatal':
    case 'error':
      return 'text-red-500';
    case 'warning':
      return 'text-amber-500';
    case 'info':
      return 'text-sky-500';
    default:
      return 'text-muted-foreground';
  }
}

/**
 * Renders a grouped breadcrumb list. Pure/presentational (no hooks, no
 * server-only APIs) — shared between this Server Component and
 * `BreadcrumbsExpand` (a `'use client'` module), which is legal in Next.js
 * as long as neither side needs directives of its own.
 */
export function BreadcrumbTimeline({
  grouped,
}: {
  grouped: GroupedBreadcrumb[];
}) {
  return (
    <ol className="relative">
      {grouped.map(({ crumb, count }, i) => {
        const Icon = crumbIcon(crumb);
        const isLast = i === grouped.length - 1;
        return (
          <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast && (
              <span className="absolute left-[13px] top-7 bottom-0 w-px bg-border" />
            )}
            <div className="relative flex size-7 shrink-0 items-center justify-center rounded-full border bg-card">
              <Icon className={cn('size-3.5', levelColor(crumb.level))} />
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground truncate">
                  {crumb.category || crumb.type || 'default'}
                  {count > 1 && (
                    <span className="ml-1.5 normal-case text-muted-foreground/70">
                      ×{count}
                    </span>
                  )}
                </span>
                {crumb.timestamp && (
                  <span className="shrink-0 font-mono text-xs text-muted-foreground/70">
                    {format(new Date(crumb.timestamp * 1000), 'HH:mm:ss')}
                  </span>
                )}
              </div>

              {crumb.message && (
                <p className="mt-0.5 break-words text-sm text-foreground">
                  {crumb.message}
                </p>
              )}

              {crumb.data && Object.keys(crumb.data).length > 0 && (
                <pre className="mt-1.5 overflow-x-auto rounded bg-muted/50 p-2 font-mono text-xs text-muted-foreground">
                  {JSON.stringify(crumb.data, null, 2)}
                </pre>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Breadcrumbs({ breadcrumbs }: BreadcrumbsProps) {
  const items = normalizeBreadcrumbs(breadcrumbs);

  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No breadcrumbs available
      </div>
    );
  }

  const summaryItems = getSummaryBreadcrumbs(items);

  return <BreadcrumbsExpand items={items} summaryItems={summaryItems} />;
}
