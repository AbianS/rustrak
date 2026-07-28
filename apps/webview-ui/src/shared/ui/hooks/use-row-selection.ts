'use client';

import { useState } from 'react';

export interface RowSelection<Id> {
  ids: ReadonlySet<Id>;
  count: number;
  /** Whether every row currently on the page is selected. */
  allSelected: boolean;
  isSelected: (id: Id) => boolean;
  toggle: (id: Id) => void;
  /** Select every row on the page, or clear the selection if all already are. */
  toggleAll: () => void;
  clear: () => void;
}

/**
 * Which rows of a paginated table the user has ticked.
 *
 * Scoped to the page, not the result set: `toggleAll` means "every row I can
 * see", because the list only ever holds one page and a select-all that
 * silently covered rows off screen would be a claim the table cannot back up.
 *
 * `allSelected` guards against the empty page, where `size === length` is
 * trivially true and would otherwise render a ticked header checkbox over no
 * rows.
 */
export function useRowSelection<Id extends string | number>(
  rowIds: readonly Id[],
): RowSelection<Id> {
  const [ids, setIds] = useState<Set<Id>>(new Set());

  return {
    ids,
    count: ids.size,
    allSelected: rowIds.length > 0 && ids.size === rowIds.length,
    isSelected: (id) => ids.has(id),

    toggle: (id) =>
      setIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),

    toggleAll: () =>
      setIds((prev) =>
        prev.size === rowIds.length ? new Set() : new Set(rowIds),
      ),

    clear: () => setIds(new Set()),
  };
}
