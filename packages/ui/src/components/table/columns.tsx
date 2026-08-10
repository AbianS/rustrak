import type { Row, RowData } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Button } from '../button/button';
import { Checkbox } from '../checkbox/checkbox';
import { DiscloseIcon } from '../icon/icon-catalog';
import type { DataTableFeatures } from './features';
import { StopPropagation } from './stop-propagation';
import { createAppColumnHelper } from './use-app-table';

/**
 * The tick column, for tables with batch actions.
 *
 * Fixed, unresizable and unhideable, because none of those are meaningful for
 * a 44px control, and provided here rather than written per table so that the
 * select-all semantics stay one decision. "All" means the rows on this page:
 * the table only ever holds one page, and a select-all reaching rows that were
 * never fetched is a claim it cannot honour.
 */
export function selectionColumn<TData extends RowData>() {
  const helper = createAppColumnHelper<TData>();
  return helper.display({
    id: 'select',
    size: 44,
    minSize: 44,
    maxSize: 44,
    header: ({ table }) => (
      <StopPropagation>
        <Checkbox
          aria-label="Select all rows on this page"
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
          }
          onCheckedChange={(checked) =>
            table.toggleAllPageRowsSelected(checked === true)
          }
        />
      </StopPropagation>
    ),
    cell: ({ row }) => (
      // Without this, ticking a row in a table whose rows expand or navigate
      // would do both.
      <StopPropagation>
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onCheckedChange={(checked) => row.toggleSelected(checked === true)}
        />
      </StopPropagation>
    ),
  });
}

/**
 * The disclosure control, for tables whose rows open a detail panel.
 *
 * A real button, and it has to be. The first version of this made the whole row
 * the control and put `aria-expanded` on the `<tr>`, which reads well and is
 * invalid: that attribute is only defined for rows inside a `treegrid`, and
 * claiming `treegrid` would promise a cell-by-cell arrow-key model this table
 * does not implement. axe rejects it, correctly.
 *
 * So the button carries the disclosure and is the row's tab stop. Clicking
 * anywhere in the row still toggles it for pointer users, through the shell's
 * `onRowClick`; that path just no longer pretends to be an ARIA widget.
 */
export function expandColumn<TData extends RowData>() {
  const helper = createAppColumnHelper<TData>();
  return helper.display({
    id: 'expand',
    size: 36,
    minSize: 36,
    maxSize: 36,
    header: () => <span className="sr-only">Expand</span>,
    cell: ({ row }) => (
      // Stops the row's own click handler from firing as well, which would
      // toggle twice and land back where it started.
      <StopPropagation>
        <Button
          variant="ghost"
          size="sm"
          aria-label={row.getIsExpanded() ? 'Hide details' : 'Show details'}
          aria-expanded={row.getIsExpanded()}
          onClick={() => row.toggleExpanded()}
          icon={({ className, ...props }) => (
            <DiscloseIcon
              {...props}
              className={cn(
                'transition-transform duration-fast ease-standard',
                row.getIsExpanded() && 'rotate-90',
                className,
              )}
            />
          )}
        />
      </StopPropagation>
    ),
  });
}

/**
 * The trailing actions column: one control per row, opening a menu.
 *
 * Provided rather than written per table for the same reason as the other two:
 * the shape is identical every time and only the contents differ, so leaving it
 * to each table means five tables with four different widths.
 *
 * What it fixes in place:
 *
 * - a width that does not grow and does not hide, because the actions are the
 *   one thing that must stay reachable when a row is squeezed;
 * - a header that exists for a screen reader and is invisible otherwise: a
 *   visible title over a column of identical buttons says nothing;
 * - `StopPropagation`, so opening the menu inside a clickable row does not also
 *   activate the row.
 *
 * The menu itself is portalled by Base UI, so it escapes the table's own scroll
 * container instead of being clipped by it.
 */
export function actionsColumn<TData extends RowData>(
  render: (row: Row<DataTableFeatures, TData>) => ReactNode,
) {
  const helper = createAppColumnHelper<TData>();
  return helper.display({
    id: 'actions',
    size: 52,
    minSize: 52,
    maxSize: 52,
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <StopPropagation>
        <div className="flex justify-end">{render(row)}</div>
      </StopPropagation>
    ),
  });
}
