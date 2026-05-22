import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface Breadcrumb {
  timestamp?: number;
  type?: string;
  category?: string;
  message?: string;
  level?: string;
  data?: Record<string, unknown>;
}

interface GroupedBreadcrumb {
  crumb: Breadcrumb;
  count: number;
}

interface BreadcrumbsProps {
  breadcrumbs?: Breadcrumb[] | { values?: Breadcrumb[] };
}

/**
 * Normalize breadcrumbs from Sentry format.
 * Sentry SDKs may send breadcrumbs as:
 * - An array directly: [{ ... }, { ... }]
 * - An object with values: { values: [{ ... }, { ... }] }
 */
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

function groupConsecutiveBreadcrumbs(items: Breadcrumb[]): GroupedBreadcrumb[] {
  const grouped: GroupedBreadcrumb[] = [];
  for (const crumb of items) {
    const last = grouped[grouped.length - 1];
    if (
      last &&
      last.crumb.category === crumb.category &&
      last.crumb.message === crumb.message &&
      last.crumb.level === crumb.level
    ) {
      last.count++;
    } else {
      grouped.push({ crumb, count: 1 });
    }
  }
  return grouped;
}

export function Breadcrumbs({ breadcrumbs }: BreadcrumbsProps) {
  const items = normalizeBreadcrumbs(breadcrumbs);
  const grouped = groupConsecutiveBreadcrumbs(items);

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No breadcrumbs available
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        {items.length} breadcrumb{items.length !== 1 ? 's' : ''}
        {grouped.length < items.length &&
          ` (${items.length - grouped.length} collapsed)`}
      </p>
      {grouped.map(({ crumb, count }, i) => (
        <div
          key={i}
          className="flex items-start gap-4 p-3 bg-card border rounded-lg"
        >
          <div className="w-20 shrink-0 text-right">
            {crumb.timestamp && (
              <span className="text-xs text-muted-foreground font-mono">
                {format(new Date(crumb.timestamp * 1000), 'HH:mm:ss')}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {crumb.category && (
                <Badge variant="outline" className="text-[10px]">
                  {crumb.category}
                </Badge>
              )}
              {crumb.level && crumb.level !== 'info' && (
                <Badge
                  variant={
                    crumb.level === 'error' ? 'destructive' : 'secondary'
                  }
                  className="text-[10px]"
                >
                  {crumb.level}
                </Badge>
              )}
              {count > 1 && (
                <Badge variant="secondary" className="text-[10px]">
                  ×{count}
                </Badge>
              )}
            </div>

            {crumb.message && (
              <p className="text-sm text-foreground">{crumb.message}</p>
            )}

            {crumb.data && Object.keys(crumb.data).length > 0 && (
              <pre className="text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded overflow-x-auto">
                {JSON.stringify(crumb.data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
