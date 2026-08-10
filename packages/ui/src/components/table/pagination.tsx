import type { RowData } from '@tanstack/react-table';
import { Button } from '../button/button';
import {
  PageFirstIcon,
  PageLastIcon,
  PageNextIcon,
  PagePreviousIcon,
} from '../icon/icon-catalog';
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
      {/* No empty case to handle: `pageCount <= 1` returned above, and under
          `manualPagination` no rows means no pages. An empty list says so
          through the shell's `empty` slot, where the message can be about what
          was being looked for. */}
      <p className="text-meta text-fg-tertiary tabular-nums" data-numeric="">
        <span className="text-fg">
          {first.toLocaleString()}-{last.toLocaleString()}
        </span>{' '}
        of {rowCount.toLocaleString()}
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          icon={PageFirstIcon}
          aria-label="First page"
          onClick={() => table.setPageIndex(0)}
          disabled={disabled || !table.getCanPreviousPage()}
        />
        <Button
          variant="ghost"
          size="sm"
          icon={PagePreviousIcon}
          aria-label="Previous page"
          onClick={() => table.previousPage()}
          disabled={disabled || !table.getCanPreviousPage()}
        />

        <span
          className="px-2 text-meta text-fg-tertiary tabular-nums"
          data-numeric=""
        >
          Page <span className="text-fg">{pageIndex + 1}</span> of{' '}
          {pageCount.toLocaleString()}
        </span>

        <Button
          variant="ghost"
          size="sm"
          icon={PageNextIcon}
          aria-label="Next page"
          onClick={() => table.nextPage()}
          disabled={disabled || !table.getCanNextPage()}
        />
        <Button
          variant="ghost"
          size="sm"
          icon={PageLastIcon}
          aria-label="Last page"
          onClick={() => table.setPageIndex(pageCount - 1)}
          disabled={disabled || !table.getCanNextPage()}
        />
      </div>
    </div>
  );
}
