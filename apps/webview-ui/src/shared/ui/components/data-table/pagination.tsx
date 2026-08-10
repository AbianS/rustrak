'use client';

import type { RowData } from '@tanstack/react-table';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/shared/ui/components/shadcn/button';
import type { DataTableInstance } from './use-app-table';

/**
 * The footer of a paginated table: what is on screen, and the way to the rest.
 *
 * Reads the table rather than taking counts, so the range and the controls
 * cannot disagree with the rows above them. Every table here is
 * `manualPagination`, so `getPageCount()` is derived from the `rowCount` the
 * server reported.
 *
 * Renders nothing when there is nothing to page through. A single page of
 * results does not need "Page 1 of 1" and two dead arrows under it.
 */
export function DataTablePagination<TData extends RowData>({
  table,
  disabled = false,
}: {
  table: DataTableInstance<TData>;
  disabled?: boolean;
}) {
  const { pageIndex, pageSize } = table.state.pagination;
  const pageCount = table.getPageCount();
  const rowCount = table.getRowCount();
  const t = useTranslations('table');

  if (pageCount <= 1) return null;

  const first = pageIndex * pageSize + 1;
  const last = Math.min((pageIndex + 1) * pageSize, rowCount);

  return (
    <div className="flex shrink-0 flex-col items-center justify-between gap-2 pt-3 sm:flex-row">
      {/* No empty case to handle: `pageCount <= 1` returned above, and under
          `manualPagination` no rows means no pages. An empty list says so
          through the shell's `empty` slot, where the message can be about what
          was being looked for. */}
      <p className="text-xs text-muted-foreground tabular-nums">
        <span className="font-medium text-foreground">
          {first.toLocaleString()}-{last.toLocaleString()}
        </span>{' '}
        {t('ofTotal', { total: rowCount.toLocaleString() })}
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label={t('firstPage')}
          onClick={() => table.setPageIndex(0)}
          disabled={disabled || !table.getCanPreviousPage()}
        >
          <ChevronsLeft className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label={t('previousPage')}
          onClick={() => table.previousPage()}
          disabled={disabled || !table.getCanPreviousPage()}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>

        <span className="px-2 text-xs text-muted-foreground tabular-nums">
          {t('pageOf', {
            current: pageIndex + 1,
            total: pageCount.toLocaleString(),
          })}
        </span>

        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label={t('nextPage')}
          onClick={() => table.nextPage()}
          disabled={disabled || !table.getCanNextPage()}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label={t('lastPage')}
          onClick={() => table.setPageIndex(pageCount - 1)}
          disabled={disabled || !table.getCanNextPage()}
        >
          <ChevronsRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
