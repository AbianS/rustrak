'use client';

import type { RowData } from '@tanstack/react-table';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Checkbox } from '@/shared/ui/components/shadcn/checkbox';
import { StopPropagation } from '@/shared/ui/components/stop-propagation';
import { createAppColumnHelper } from './use-app-table';

/**
 * The indeterminate state, drawn from outside the shadcn component.
 *
 * Base UI reports a partial selection as `aria-checked="mixed"` and nothing
 * else; the shadcn checkbox only styles `data-checked` and only ever renders a
 * tick, so a header covering one selected row out of twelve draws a full tick
 * and claims all of them are selected. These variants fill the box the same
 * way a checked one is filled, hide the tick, and put a dash in its place.
 *
 * `before:` and not `after:`, which the component already spends on widening
 * its hit area.
 */
const MIXED = cn(
  'aria-[checked=mixed]:border-primary aria-[checked=mixed]:bg-primary',
  // The component carries a `dark:bg-input/30`, which sorts after a bare
  // `aria-` variant and would otherwise win in dark mode and leave the box
  // empty with an invisible dash inside it.
  'dark:aria-[checked=mixed]:bg-primary',
  'aria-[checked=mixed]:text-primary-foreground',
  '[&[aria-checked=mixed]_svg]:hidden',
  'aria-[checked=mixed]:before:absolute aria-[checked=mixed]:before:h-0.5',
  'aria-[checked=mixed]:before:w-2 aria-[checked=mixed]:before:rounded-full',
  'aria-[checked=mixed]:before:bg-current',
);

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
          className={MIXED}
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
 * The disclosure chevron, for tables whose rows open a detail panel.
 *
 * Deliberately not a button: the whole row is the control, wired through the
 * shell's `onRowClick`, and a nested button would put a second tab stop on
 * every row that does the same thing as the first.
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
      <ChevronRight
        aria-hidden="true"
        className={cn(
          'size-4 text-muted-foreground transition-transform',
          row.getIsExpanded() && 'rotate-90',
        )}
      />
    ),
  });
}
