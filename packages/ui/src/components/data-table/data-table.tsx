import type { Cell, Header, Row, RowData } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import type { MouseEvent, ReactNode } from 'react';
import { interactiveTransition, swapAnimation } from '../../lib/motion';
import { tv } from '../../lib/tv';
import { Button } from '../button/button';
import { EmptyIcon } from '../icon/icon-catalog';
import { Text } from '../text/text';
import { DataTableColumnHeader } from './column-header';
import type { DataTableFeatures } from './features';
import { DataTablePagination } from './pagination';
import type { DataTableInstance } from './use-data-table';

/**
 * The rendering half of the table; `useDataTable` is the state half.
 *
 * It is one card: rows, their header, and the footer that places you in the
 * result, drawn to the issue-list blueprint -- 38 px header, 48 px rows, the
 * panel surface inside a subtle border. What it renders is decided entirely
 * by the column definitions and the instance's state; the component adds no
 * options of its own beyond the three slots the columns cannot express: what
 * an empty result says, what a loading one shows, and what the header offers
 * once rows are selected.
 */
const dataTable = tv({
  slots: {
    card: [
      'flex min-h-0 flex-col overflow-hidden',
      'rounded-xl border border-border-subtle bg-panel',
    ],
    scroller: 'min-h-0 flex-1 overflow-auto',
    table: 'w-full border-separate border-spacing-0',
    /*
     * Sticky needs everything else to be true at once: the `th` is the
     * sticking element (a sticky `thead` breaks in Safari), it needs its own
     * opaque background or rows show through it mid-scroll, and the head's
     * rule must be a border on the `th` itself -- with `border-collapse` the
     * border would belong to the table and stay behind while the cell floats.
     */
    th: [
      // Above the row-action overlays, which are z-10 later in tree order.
      'sticky top-0 z-20 h-row-head bg-surface',
      'border-border-subtle border-b px-2',
      'text-start first:pl-4 last:pr-4',
    ],
    td: [
      'h-row border-border-divider border-b px-2',
      'text-body text-fg-secondary',
      'first:pl-4 last:pr-4',
      'data-[align=end]:text-end',
      'data-[numeric=true]:font-mono data-[numeric=true]:text-fg',
      'data-[numeric=true]:text-numeric data-[numeric=true]:tabular-nums',
    ],
    row: [
      'group/row',
      interactiveTransition,
      'hover:bg-surface-hover',
      'data-[selected=true]:bg-surface-raised',
      'data-[clickable=true]:cursor-pointer',
    ],
    /*
     * The header's second life. With rows selected, the column titles step
     * aside and the same 38 px strip holds what can be done to the selection
     * -- the Gmail pattern, because the alternative is a second toolbar that
     * pushes the whole table down exactly when the reader is mid-gesture.
     * Both directions of the swap enter with `swapAnimation`: the outgoing
     * side unmounts, the incoming one rises 2 px into place, and the row
     * itself never moves.
     */
    bulk: ['flex h-full items-center gap-1.5', swapAnimation],
    headerSwap: ['h-full', swapAnimation],
    bulkCount: 'me-2 font-medium text-control text-fg',
    empty: [
      'flex flex-col items-center justify-center gap-3',
      'px-6 py-16 text-center',
    ],
    skeleton: 'h-3 animate-pulse rounded-xs bg-surface-chip',
  },
});

const styles = dataTable();

export interface DataTableEmptyProps {
  title?: string;
  description?: string;
}

export interface DataTableProps<TData extends RowData> {
  table: DataTableInstance<TData>;
  /**
   * The page is being fetched. With rows on screen they stay, dimmed --
   * yanking a list someone is reading to show a shimmer where it was is the
   * jumpiest thing a refetch can do. Skeletons only stand in when there is
   * nothing yet.
   */
  loading?: boolean;
  /** What an empty result says. The clear-filters offer appears on its own. */
  empty?: DataTableEmptyProps;
  /**
   * What the header offers while rows are selected: resolve, mute, delete.
   * Rendered beside the built-in count and Clear; read the selection off the
   * table instance. Without it the header never changes.
   */
  bulkActions?: ReactNode;
  /** Opens the row. Also offered to the keyboard as Enter on the row. */
  onRowClick?: (row: Row<DataTableFeatures, TData>) => void;
  className?: string;
}

function cellAttributes<TData extends RowData>(
  cell: Cell<DataTableFeatures, TData, unknown>,
) {
  const meta = cell.column.columnDef.meta;
  return {
    'data-align': meta?.align,
    'data-numeric': meta?.numeric || undefined,
  };
}

export function DataTable<TData extends RowData>({
  table,
  loading = false,
  empty,
  bulkActions,
  onRowClick,
  className,
}: DataTableProps<TData>) {
  const rows = table.getRowModel().rows;
  const columns = table.getVisibleLeafColumns();
  const filtered =
    table.state.columnFilters.length > 0 || Boolean(table.state.globalFilter);
  const selectedCount = Object.keys(table.state.rowSelection).length;
  const bulkMode = bulkActions != null && selectedCount > 0;

  /*
   * A click that lands on a control inside the row -- the checkbox, an
   * action, a link a cell rendered -- belongs to that control. Only the inert
   * remainder of the row opens it.
   */
  function handleRowClick(
    row: Row<DataTableFeatures, TData>,
    event: MouseEvent,
  ) {
    if (!onRowClick) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, label, [role="checkbox"]')) return;
    onRowClick(row);
  }

  return (
    <div className={styles.card({ className })}>
      <div className={styles.scroller()} aria-busy={loading}>
        <table className={styles.table()}>
          <colgroup>
            {columns.map((column) => (
              <col
                key={column.id}
                style={{
                  width:
                    column.id === 'select' ? 40 : column.columnDef.meta?.width,
                }}
              />
            ))}
          </colgroup>

          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {bulkMode && headerGroup.headers[0]?.column.id === 'select' ? (
                  <>
                    {/* The box stays: it is how the selection is grown to the
                        page or emptied, and it must not jump. */}
                    <th scope="col" className={styles.th()}>
                      <span className="flex items-center">
                        {flexRender(
                          headerGroup.headers[0].column.columnDef.header,
                          headerGroup.headers[0].getContext(),
                        )}
                      </span>
                    </th>
                    <th
                      scope="col"
                      colSpan={headerGroup.headers.length - 1}
                      className={styles.th()}
                    >
                      <div
                        role="toolbar"
                        aria-label="Actions for the selected rows"
                        className={styles.bulk()}
                      >
                        <span aria-live="polite" className={styles.bulkCount()}>
                          {selectedCount} selected
                        </span>
                        {bulkActions}
                        <Button
                          variant="ghost"
                          size="xs"
                          className="ms-auto"
                          onClick={() => table.toggleAllRowsSelected(false)}
                        >
                          Clear
                        </Button>
                      </div>
                    </th>
                  </>
                ) : (
                  headerGroup.headers.map((header) => (
                    <HeaderCell key={header.id} header={header} />
                  ))
                )}
              </tr>
            ))}
          </thead>

          <tbody className={loading && rows.length ? 'opacity-60' : undefined}>
            {rows.map((row) => (
              <tr
                key={row.id}
                data-selected={row.getIsSelected() || undefined}
                data-clickable={onRowClick ? true : undefined}
                // A `role` override would break the row/cell relationship a
                // table needs; the row stays a row and only gains a tab stop.
                tabIndex={onRowClick ? 0 : undefined}
                onClick={(event) => handleRowClick(row, event)}
                onKeyDown={(event) => {
                  if (!onRowClick) return;
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  if (event.target !== event.currentTarget) return;
                  event.preventDefault();
                  onRowClick(row);
                }}
                className={styles.row()}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    {...cellAttributes(cell)}
                    className={styles.td()}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}

            {loading && rows.length === 0
              ? Array.from({ length: 8 }, (_, line) => (
                  // Skeleton rows have no identity beyond their position.
                  <tr key={line} className={styles.row()}>
                    {columns.map((column) => (
                      <td key={column.id} className={styles.td()}>
                        <span
                          aria-hidden="true"
                          className={styles.skeleton({
                            className: column.columnDef.meta?.width
                              ? 'block w-3/5'
                              : 'block w-4/5',
                          })}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : null}
          </tbody>
        </table>

        {!loading && rows.length === 0 ? (
          <div className={styles.empty()}>
            <EmptyIcon
              size="2xl"
              aria-hidden="true"
              className="text-fg-ghost"
            />
            <div className="flex flex-col gap-1">
              <Text variant="card-title">{empty?.title ?? 'No results'}</Text>
              <Text variant="meta" tone="subtle">
                {empty?.description ??
                  (filtered
                    ? 'Nothing matches the current filters.'
                    : 'There is nothing here yet.')}
              </Text>
            </div>
            {filtered ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  table.setColumnFilters([]);
                  table.setGlobalFilter('');
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <DataTablePagination table={table} />
    </div>
  );
}

DataTable.displayName = 'DataTable';

/**
 * One column heading.
 *
 * `aria-sort` is on the `th` rather than on the button inside it because the
 * sort state describes the column, and a screen reader reads it while moving
 * between columns, not only when it lands on the control.
 */
function HeaderCell<TData extends RowData>({
  header,
}: {
  header: Header<DataTableFeatures, TData, unknown>;
}) {
  const sorted = header.column.getIsSorted();
  const ariaSort =
    sorted === 'asc'
      ? 'ascending'
      : sorted === 'desc'
        ? 'descending'
        : undefined;

  return (
    <th
      scope="col"
      colSpan={header.colSpan}
      aria-sort={ariaSort}
      className={styles.th()}
    >
      <HeaderContent header={header} />
    </th>
  );
}

/** The heading itself: the select box renders bare, every other column swaps. */
function HeaderContent<TData extends RowData>({
  header,
}: {
  header: Header<DataTableFeatures, TData, unknown>;
}) {
  if (header.isPlaceholder) return null;

  if (header.column.id === 'select') {
    return (
      <span className="flex items-center">
        {flexRender(header.column.columnDef.header, header.getContext())}
      </span>
    );
  }

  return (
    /* Re-enters the same way the bulk strip arrived, so the swap reads as one
       exchange, not two events. */
    <div className={styles.headerSwap()}>
      <DataTableColumnHeader header={header} />
    </div>
  );
}
