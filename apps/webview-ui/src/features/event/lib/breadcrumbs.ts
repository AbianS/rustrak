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
