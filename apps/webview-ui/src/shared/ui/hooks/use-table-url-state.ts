'use client';

import type {
  OnChangeFn,
  PaginationState,
  Updater,
} from '@tanstack/react-table';
import { useTransition } from 'react';

/** Applies a TanStack updater, which is either the next value or a reducer. */
function resolve<T>(updater: Updater<T>, current: T): T {
  return typeof updater === 'function'
    ? (updater as (old: T) => T)(current)
    : updater;
}

export interface TableUrlState {
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  /** A navigation or mutation is in flight. Feed it to the shell to dim. */
  isPending: boolean;
  /**
   * Runs a mutation inside the same transition the pager uses.
   *
   * A batch resolve and a page change are the same thing to a reader: the rows
   * are about to be replaced. Sharing the transition means they share
   * `isPending`, so the table dims once, for both, instead of each list
   * growing a spinner of its own.
   */
  run: (action: () => void | Promise<void>) => void;
}

/**
 * The page a table is showing, kept in the URL rather than in the component.
 *
 * Every list here is server-paginated, which means the page is not view state:
 * it is part of the request, and the request is what the address bar
 * describes. Keeping it there is what makes the back button, a refresh and a
 * pasted link all land on the same rows.
 *
 * The caller keeps ownership of the URL's shape. A list has other parameters
 * of its own -- a level, a filter, an environment -- and a hook that tried to
 * own the whole query string would have to be told about all of them.
 *
 * `page` is 1-based here, the way the API and the address bar speak, and
 * 0-based inside the table, the way TanStack speaks. This is the seam where
 * that is translated, once.
 */
export function useTableUrlState({
  page,
  perPage,
  navigate,
}: {
  page: number;
  perPage: number;
  navigate: (next: { page: number }) => void;
}): TableUrlState {
  const [isPending, startTransition] = useTransition();

  const pagination: PaginationState = {
    pageIndex: Math.max(0, page - 1),
    pageSize: perPage,
  };

  return {
    pagination,
    isPending,

    run: (action) => {
      startTransition(async () => {
        await action();
      });
    },

    onPaginationChange: (updater) => {
      const next = resolve(updater, pagination);
      if (next.pageIndex === pagination.pageIndex) return;
      startTransition(() => {
        navigate({ page: next.pageIndex + 1 });
      });
    },
  };
}
