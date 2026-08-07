'use client';

import type { RowData } from '@tanstack/react-table';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
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

  if (pageCount <= 1) return null;

  const first = pageIndex * pageSize + 1;
  const last = Math.min((pageIndex + 1) * pageSize, rowCount);

  return (
    <div className="flex shrink-0 flex-col items-center justify-between gap-2 pt-3 sm:flex-row">
      <p className="text-xs text-muted-foreground tabular-nums">
        {rowCount > 0 ? (
          <>
            <span className="font-medium text-foreground">
              {first.toLocaleString()}-{last.toLocaleString()}
            </span>{' '}
            of {rowCount.toLocaleString()}
          </>
        ) : (
          'No results'
        )}
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="First page"
          onClick={() => table.setPageIndex(0)}
          disabled={disabled || !table.getCanPreviousPage()}
        >
          <ChevronsLeft className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="Previous page"
          onClick={() => table.previousPage()}
          disabled={disabled || !table.getCanPreviousPage()}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>

        <span className="px-2 text-xs text-muted-foreground tabular-nums">
          Page{' '}
          <span className="font-medium text-foreground">{pageIndex + 1}</span>{' '}
          of {pageCount.toLocaleString()}
        </span>

        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="Next page"
          onClick={() => table.nextPage()}
          disabled={disabled || !table.getCanNextPage()}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="Last page"
          onClick={() => table.setPageIndex(pageCount - 1)}
          disabled={disabled || !table.getCanNextPage()}
        >
          <ChevronsRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
