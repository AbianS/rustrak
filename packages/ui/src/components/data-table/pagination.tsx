import type { RowData } from '@tanstack/react-table';
import { uiLabel, uiLocale } from '../../lib/labels';
import { tv } from '../../lib/tv';
import { Button } from '../button/button';
import { ChevronLeftIcon, ChevronRightIcon } from '../icon/icon-catalog';
import { Menu } from '../menu/menu';
import { Tooltip } from '../tooltip/tooltip';
import type { DataTableInstance } from './use-data-table';

/**
 * The table's footer: where you are in the result, and the only two controls
 * whose subject is the result rather than a column.
 *
 * The range reads `1–50 of 12,403` and not `page 1 of 249`, because rows are
 * what the reader counts; the page fraction is still there, small and mono,
 * between the arrows for whoever is stepping. Selection is reported here too:
 * the ticks happen spread across the page, and this is the one line that can
 * total them without following the pointer around.
 */
const pagination = tv({
  slots: {
    footer: [
      'flex h-11 shrink-0 items-center justify-between gap-4',
      'border-border-subtle border-t px-4',
      'text-fg-subtle text-meta',
    ],
    figure: 'font-medium text-fg-secondary',
    fraction: 'px-1.5 font-mono text-fg-subtle text-mono-sm tabular-nums',
  },
});

const styles = pagination();

const PAGE_SIZES = [25, 50, 100];

export interface DataTablePaginationProps<TData extends RowData> {
  table: DataTableInstance<TData>;
}

export function DataTablePagination<TData extends RowData>({
  table,
}: DataTablePaginationProps<TData>) {
  const number = new Intl.NumberFormat(uiLocale());
  const { pageIndex, pageSize } = table.state.pagination;
  const rowCount = table.options.rowCount ?? table.getRowCount();
  const pageCount = table.getPageCount();
  const selected = Object.keys(table.state.rowSelection).length;

  const first = rowCount === 0 ? 0 : pageIndex * pageSize + 1;
  const last = Math.min((pageIndex + 1) * pageSize, rowCount);

  return (
    <div className={styles.footer()}>
      <span aria-live="polite">
        {uiLabel('pageRange', {
          first: number.format(first),
          last: number.format(last),
          total: number.format(rowCount),
        })}
        {selected > 0 ? (
          <>
            {' '}
            ·{' '}
            <span className={styles.figure()}>
              {uiLabel('rowsSelected', { count: number.format(selected) })}
            </span>
          </>
        ) : null}
      </span>

      <div className="flex items-center gap-3">
        <Menu
          align="end"
          trigger={
            <Button variant="ghost" size="xs" menu>
              {uiLabel('rowsPerPageValue', { count: pageSize })}
            </Button>
          }
          actions={PAGE_SIZES.map((size) => ({
            id: String(size),
            label: uiLabel('rowsOption', { count: size }),
            onSelect: () => table.setPageSize(size),
          }))}
        />

        <div className="flex items-center gap-1">
          <Tooltip content="Previous page">
            <Button
              variant="secondary"
              size="xs"
              icon={ChevronLeftIcon}
              aria-label={uiLabel('previousPage')}
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            />
          </Tooltip>
          <span aria-hidden="true" className={styles.fraction()}>
            {pageCount === 0 ? 0 : pageIndex + 1} / {pageCount}
          </span>
          <Tooltip content="Next page">
            <Button
              variant="secondary"
              size="xs"
              icon={ChevronRightIcon}
              aria-label={uiLabel('nextPage')}
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

DataTablePagination.displayName = 'DataTablePagination';
