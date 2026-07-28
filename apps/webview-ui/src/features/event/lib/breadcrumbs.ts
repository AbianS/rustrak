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

/**
 * Collapse runs of identical consecutive crumbs into one entry with a count.
 *
 * A crumb carrying `data` never merges, in either direction: the payload is
 * the part a reader is looking at, and two crumbs that agree on every other
 * field can still differ there.
 */
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

/**
 * How many of the most recent breadcrumbs to show inline before collapsing
 * the rest behind a "view all" affordance. Matches Sentry's own default
 * (BREADCRUMB_SUMMARY_COUNT in
 * static/app/components/events/breadcrumbs/utils.tsx) — the event already
 * carries every breadcrumb the SDK sent (Relay doesn't truncate by count),
 * this is purely about not dumping the whole timeline inline.
 */
const BREADCRUMB_SUMMARY_COUNT = 5;

/**
 * Return the most recent `count` breadcrumbs for the inline summary view.
 * If collapsing would only hide a single item, show everything instead —
 * a "view 1 more" button isn't worth the extra click. Mirrors
 * `getSummaryBreadcrumbs()` in Sentry's frontend.
 */
export function getSummaryBreadcrumbs<T>(
  items: T[],
  count: number = BREADCRUMB_SUMMARY_COUNT,
): T[] {
  if (items.length <= count + 1) return items;
  return items.slice(items.length - count);
}
