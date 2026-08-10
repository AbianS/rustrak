import type { Row, RowData } from '@tanstack/react-table';
import { Fragment, type ReactNode, useRef } from 'react';
import { cn } from '../../lib/cn';
import type { DataTableFeatures } from './features';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './primitives';
import { HIDE_BELOW_CLASS, useColumnLayout, useVisibleTiers } from './sizing';
import type { DataTableInstance } from './use-app-table';

/**
 * Column ids reach CSS as custom property names, and a custom property name
 * cannot hold whatever a column id happens to hold.
 */
const cssSafe = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '_');

/** Where a column reads its width. See `useColumnLayout` for what sets it. */
const widthOf = (columnId: string) => `var(--col-${cssSafe(columnId)}-size)`;

/** One duration for both halves of the header swap, so they read as one move. */
const SWAP = 'transition-[transform,opacity] duration-slow ease-standard';

const DENSITY = {
  compact: { head: 'h-8', cell: 'py-1.5' },
  normal: { head: 'h-10', cell: 'py-2.5' },
} as const;

export interface DataTableProps<TData extends RowData> {
  table: DataTableInstance<TData>;
  /** Row height. `compact` is for high-volume lists: logs, spans, events. */
  density?: keyof typeof DENSITY;
  /**
   * Pins the header while the body scrolls. Requires the table to be inside a
   * height-bounded container, which is the shell's own scroll box.
   */
  stickyHeader?: boolean;
  /**
   * A navigation or mutation is in flight. Dims the body and blocks pointer
   * input without unmounting it, so the page does not collapse to a spinner
   * and back on every page change.
   */
  isPending?: boolean;
  /**
   * Shown under the header when there are no rows.
   *
   * The table stays: its header is what tells a reader what they were looking
   * for and what a filter is currently hiding, and swapping the whole thing
   * for a message takes that away at the moment it is most useful.
   */
  empty?: ReactNode;
  /**
   * What to offer once rows are ticked.
   *
   * Rendered **inside the header row**, not above the table: the column titles
   * slide down out of the way and these drop in from above to take their
   * place. A bar that appeared above the table instead would push everything
   * below it down by its own height the moment a checkbox was clicked.
   */
  bulkActions?: ReactNode;
  /**
   * An extra row rendered under an expanded row, spanning the full width.
   *
   * This is markup, not data: the table has no sub-rows, so expanding is a
   * disclosure of detail about the row the user already has.
   */
  renderDetail?: (row: Row<DataTableFeatures, TData>) => ReactNode;
  /** Makes the whole row activate. Leave unset when only part of it should. */
  onRowClick?: (row: Row<DataTableFeatures, TData>) => void;
  /**
   * A class for one row, from what the row is.
   *
   * For state the columns cannot express on their own: a disabled rule that
   * should read as dimmed, a row mid-deletion. Not a styling hook for things a
   * cell could say itself.
   */
  getRowClassName?: (row: Row<DataTableFeatures, TData>) => string | undefined;
  className?: string;
}

/**
 * The table shell every Rustrak list renders through.
 *
 * ## How width works
 *
 * One model, no modes. A column either has a fixed `size` in pixels or is
 * marked `meta.grow` and takes what is left over. Every resulting width is a
 * number computed in `useColumnLayout` and handed to the browser, which is
 * left with no distribution of its own to do -- see that file for why letting
 * it try does not survive a resize.
 *
 * The table is exactly as wide as its columns add up to. When that exceeds the
 * container the container scrolls horizontally, which is what `minSize` on the
 * growing column ultimately decides. Same contract as AG Grid's and MUI
 * DataGrid's `flex` plus `minWidth`.
 */
export function DataTable<TData extends RowData>({
  table,
  density = 'normal',
  stickyHeader = false,
  isPending = false,
  empty,
  bulkActions,
  renderDetail,
  onRowClick,
  getRowClassName,
  className,
}: DataTableProps<TData>) {
  const container = useRef<HTMLDivElement>(null);
  const visibleTiers = useVisibleTiers();
  const { widths, totalWidth, fillerWidth } = useColumnLayout(
    table,
    container,
    visibleTiers,
  );
  const rows = table.getRowModel().rows;
  const spacing = DENSITY[density];
  const showBulk =
    Boolean(bulkActions) && table.getSelectedRowModel().rows.length > 0;

  /**
   * Widths reach the cells as custom properties on the `<table>` rather than
   * as an inline width on every cell, so a resize drag rewrites one attribute
   * instead of one per cell and the cells' own style strings never change.
   */
  const widthVars: Record<string, string> = {};
  for (const [columnId, width] of widths) {
    widthVars[`--col-${cssSafe(columnId)}-size`] = `${width}px`;
  }

  return (
    <div
      ref={container}
      className={cn(
        // This element is the scroll box, and it has to be: a sticky header is
        // sticky inside whatever scrolls, so a second wrapper anywhere in
        // between would silently detach the two. `primitives.tsx` deliberately
        // brings no wrapper of its own.
        'relative min-h-0 overflow-auto rounded-lg',
        'bg-surface inset-ring inset-ring-border',
        isPending && 'pointer-events-none',
        className,
      )}
    >
      <Table
        style={{
          ...widthVars,
          width: totalWidth ? totalWidth + fillerWidth : undefined,
        }}
        className={cn(
          'table-fixed',
          isPending && 'opacity-60 transition-opacity',
        )}
      >
        <TableHeader
          className={cn(
            stickyHeader && 'sticky top-0 z-10',
            // Opaque, or the rows scroll through it.
            'bg-surface',
          )}
        >
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="bg-surface-subtle hover:bg-surface-subtle"
            >
              {headerGroup.headers.map((header, index) => {
                const meta = header.column.columnDef.meta;
                // The tick column keeps its head while the rest slide away:
                // the bar starts to its right precisely so select-all survives
                // the swap, and a checkbox that left with the titles would
                // undo that.
                const keepsTitle = Boolean(bulkActions) && index === 0;
                return (
                  <TableHead
                    key={header.id}
                    style={{ width: widthOf(header.column.id) }}
                    className={cn(
                      'relative select-none',
                      spacing.head,
                      meta?.hideBelow && HIDE_BELOW_CLASS[meta.hideBelow],
                      meta?.className,
                      meta?.headerClassName,
                    )}
                  >
                    {/* The clip lives on a wrapper rather than on the cell so
                        the title can slide out of sight while the resize
                        handle, which straddles the cell's edge, does not get
                        cut in half by the same rule. */}
                    {header.isPlaceholder ? null : (
                      <div className="overflow-hidden">
                        <span
                          className={cn(
                            'block truncate',
                            SWAP,
                            meta?.align === 'end' && 'text-right',
                            showBulk &&
                              !keepsTitle &&
                              'translate-y-full opacity-0',
                          )}
                        >
                          <table.FlexRender header={header} />
                        </span>
                      </div>
                    )}

                    {/* Anchored to the first cell and widened across the rest
                        of the table, so it covers the header row without
                        needing a row of its own -- a second row would be what
                        decides the column widths under `table-fixed`.
                        Sliding it up hides it: the scroll container's own edge
                        clips it.

                        It starts *after* the first column, which is the tick
                        column on every table that has batch actions. Covering
                        that too would take away select-all at exactly the
                        moment someone is selecting. */}
                    {index === 0 && bulkActions && (
                      <div
                        aria-hidden={!showBulk}
                        // `pointer-events-none` would stop the pointer and
                        // leave the buttons in the tab order, which is a
                        // focusable control inside an `aria-hidden` subtree.
                        // `inert` takes both away at once.
                        inert={!showBulk}
                        style={{
                          left: widths.get(header.column.id) ?? 0,
                          width:
                            totalWidth +
                            fillerWidth -
                            (widths.get(header.column.id) ?? 0),
                        }}
                        className={cn(
                          // Above the column dividers, which are `z-20`: while
                          // the header is an action bar it is not a set of
                          // columns, and boundaries showing through it read as
                          // stray marks.
                          'absolute inset-y-0 z-30',
                          // The header row is `bg-surface-subtle` over the
                          // header's own `bg-surface`. Repeating both, in that
                          // order, is what keeps the swap from also being a
                          // change of colour: only the contents move.
                          'bg-surface',
                          SWAP,
                          showBulk
                            ? 'translate-y-0 opacity-100'
                            : '-translate-y-full opacity-0',
                        )}
                      >
                        <div className="flex h-full items-center gap-2 bg-surface-subtle pr-3 text-fg">
                          {bulkActions}
                        </div>
                      </div>
                    )}
                  </TableHead>
                );
              })}
              {/* A `td`, not a `th`: this cell exists only so the rows reach
                  the container's border, and it heads no column. Left without
                  a role, because marking a cell presentational is what both
                  linters here flag, and an empty trailing cell reads as what
                  it is. */}
              {fillerWidth > 0 && <td style={{ width: fillerWidth }} />}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {rows.map((row) => {
            const isExpanded = row.getIsExpanded();
            const detail = isExpanded ? renderDetail?.(row) : null;

            return (
              <Fragment key={row.id}>
                <TableRow
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  // A tab stop only when the row is the sole way in. A table
                  // with `renderDetail` puts a real button in `expandColumn`
                  // that already carries the disclosure and its own tab stop;
                  // a second one here would be two stops per row doing the same
                  // thing. The row click stays either way, for the pointer.
                  tabIndex={onRowClick && !renderDetail ? 0 : undefined}
                  onKeyDown={
                    onRowClick && !renderDetail
                      ? (event) => {
                          if (event.key !== 'Enter' && event.key !== ' ')
                            return;
                          // A key pressed inside a cell's own control -- a
                          // checkbox, a link -- belongs to that control.
                          if (event.target !== event.currentTarget) return;
                          // Or Space scrolls the page out from under the row it
                          // just expanded.
                          event.preventDefault();
                          onRowClick(row);
                        }
                      : undefined
                  }
                  className={cn(
                    onRowClick &&
                      'cursor-pointer outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-ring',
                    isExpanded && 'bg-surface-subtle hover:bg-surface-subtle',
                    getRowClassName?.(row),
                  )}
                >
                  {row.getAllCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;
                    return (
                      <TableCell
                        key={cell.id}
                        style={{ width: widthOf(cell.column.id) }}
                        className={cn(
                          // `max-w-0` is what lets `truncate` inside a cell
                          // measure against the column instead of the content,
                          // which is the difference between a growing column
                          // that ellipsises and one that forces a scrollbar.
                          'max-w-0',
                          spacing.cell,
                          meta?.align === 'end' && 'text-right',
                          meta?.hideBelow && HIDE_BELOW_CLASS[meta.hideBelow],
                          meta?.className,
                        )}
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    );
                  })}
                  {fillerWidth > 0 && <td />}
                </TableRow>

                {detail && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={
                        row.getAllCells().length + (fillerWidth > 0 ? 1 : 0)
                      }
                      className="bg-surface-sunken p-0"
                    >
                      {detail}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>

      {rows.length === 0 && empty}
    </div>
  );
}
