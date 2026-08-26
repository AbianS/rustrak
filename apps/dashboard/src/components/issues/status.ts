import type { MessageKey, Translator } from '@rustrak/i18n';
import type { DataTableQuery, QueryField } from '@rustrak/ui';

/**
 * The four states an issue list is read in, as the server's `is:` filter
 * spells them.
 *
 * It is a filter in the bar and not a control of its own. There is no state
 * where an issue list has no status, so a separate widget would be a second
 * place saying the same thing, and the two could disagree about what is on
 * screen. As a chip it sits with `level:` and `seen:` and is cleared, typed
 * and shared exactly like them.
 */
export const STATUSES = ['open', 'resolved', 'muted', 'all'] as const;

export type Status = (typeof STATUSES)[number];

/**
 * What a list shows when nobody has said otherwise.
 *
 * It is a real chip rather than an absence, so the bar always says which
 * issues are being looked at. It is still left out of the address: a URL with
 * no `q` at all is the same list, and the server defaults to open too.
 */
export const DEFAULT_STATUS: Status = 'open';

const LABELS: Record<Status, MessageKey> = {
  open: 'issueList.statusOpen',
  resolved: 'issueList.statusResolved',
  muted: 'issueList.statusMuted',
  all: 'issueList.statusAll',
};

/** The bar's field for `is:`. It has no column, because it draws no cells. */
export function statusField(t: Translator): QueryField {
  return {
    key: 'is',
    label: t.t('issueList.status'),
    variant: 'options',
    // One state at a time. "Resolved or muted" is not a question anyone asks;
    // `all` is how you say you do not care.
    multiple: false,
    options: STATUSES.map((status) => ({
      value: status,
      label: t.t(LABELS[status]),
    })),
  };
}

/** The query with its status chip present, whether the URL carried one or not. */
export function withDefaultStatus(query: DataTableQuery): DataTableQuery {
  if (query.filters.some((entry) => entry.id === 'is')) return query;

  return {
    ...query,
    filters: [{ id: 'is', value: [DEFAULT_STATUS] }, ...query.filters],
  };
}

/**
 * The query as the address bar should carry it.
 *
 * The default status is dropped on the way out, so a list nobody has narrowed
 * has an empty query string. `withDefaultStatus` puts it back on the way in,
 * which is what keeps the chip on screen without putting `is=open` in every
 * link anybody shares.
 */
export function withoutDefaultStatus(query: DataTableQuery): DataTableQuery {
  return {
    ...query,
    filters: query.filters.filter(
      (entry) =>
        !(
          entry.id === 'is' &&
          Array.isArray(entry.value) &&
          entry.value.length === 1 &&
          entry.value[0] === DEFAULT_STATUS
        ),
    ),
  };
}
