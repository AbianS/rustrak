import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Badge } from '../badge/badge';
import { Button } from '../button/button';
import {
  AssignIcon,
  DeleteIcon,
  IgnoreIcon,
  OverflowIcon,
  ResolveIcon,
} from '../icon/icon-catalog';
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from '../menu/menu';
import { SeverityDot } from '../severity/severity-dot';
import { actionsColumn, expandColumn, selectionColumn } from './columns';
import { DataTable } from './data-table';
import { DataTablePagination } from './pagination';
import { createAppColumnHelper, useAppTable } from './use-app-table';

interface Issue {
  id: string;
  title: string;
  culprit: string;
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  events: number;
  release: string;
}

const ISSUES: Issue[] = [
  {
    id: 'CHECKOUT-API-4F2',
    title: "TypeError: Cannot read properties of undefined (reading 'total')",
    culprit: 'src/checkout/summary.tsx · renderTotals',
    level: 'error',
    events: 12431,
    release: 'web@2026.8.1',
  },
  {
    id: 'CHECKOUT-API-3B1',
    title: 'ConnectionTimeout: pool exhausted after 30000ms',
    culprit: 'db/pool.rs · acquire',
    level: 'fatal',
    events: 3902,
    release: 'api@2026.8.0',
  },
  {
    id: 'CHECKOUT-API-2C8',
    title: 'ValidationError: coupon code not applicable',
    culprit: 'src/promo/apply.ts · applyCoupon',
    level: 'warning',
    events: 1204,
    release: 'web@2026.8.1',
  },
];

const helper = createAppColumnHelper<Issue>();

// `helper.columns()` rather than a bare array: mixing a display column (typed
// `unknown`) with accessor columns (typed by their field) in one literal makes
// TypeScript infer an element type neither of them satisfies. This is the
// wrapper v9 provides for exactly that.
const columns = helper.columns([
  helper.accessor('level', {
    id: 'level',
    header: 'Lvl',
    size: 56,
    cell: ({ getValue }) => <SeverityDot level={getValue()} />,
  }),
  helper.accessor('title', {
    id: 'issue',
    header: 'Issue',
    // Exactly one growing column per table: it absorbs whatever the fixed
    // columns leave over, and its `minSize` is what decides when the container
    // starts scrolling instead.
    meta: { grow: true },
    minSize: 220,
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-body text-fg">{row.original.title}</span>
        <span className="truncate font-mono text-code text-fg-muted">
          {row.original.culprit}
        </span>
      </div>
    ),
  }),
  helper.accessor('release', {
    id: 'release',
    header: 'Release',
    size: 150,
    // Dropped on a narrow viewport. In CSS, so it resolves before the first
    // paint; `useVisibleTiers` reads the same breakpoint for the arithmetic.
    meta: { hideBelow: 'lg' },
    cell: ({ getValue }) => <Badge>{getValue()}</Badge>,
  }),
  helper.accessor('events', {
    id: 'events',
    header: 'Events',
    size: 100,
    meta: { align: 'end', hideBelow: 'sm' },
    cell: ({ getValue }) => (
      <span
        className="tabular-nums text-meta text-fg-secondary"
        data-numeric=""
      >
        {getValue().toLocaleString('en-GB')}
      </span>
    ),
  }),
]);

function IssuesTable({
  withSelection = false,
  withDetail = false,
  withBulk = false,
  withActions = false,
}: {
  /**
   * The tick column. Off by default, because most tables are lists you read
   * rather than sets you act on, and a column of checkboxes on one of those is
   * 44px of nothing plus a select-all that means nothing.
   */
  withSelection?: boolean;
  withDetail?: boolean;
  withBulk?: boolean;
  /** The trailing overflow menu, which is how most rows end. */
  withActions?: boolean;
}) {
  const [rowSelection, setRowSelection] = useState({});
  const [expanded, setExpanded] = useState({});

  const table = useAppTable({
    data: ISSUES,
    columns: helper.columns([
      ...(withDetail ? [expandColumn<Issue>()] : []),
      ...(withSelection ? [selectionColumn<Issue>()] : []),
      ...columns,
      ...(withActions
        ? [actionsColumn<Issue>((row) => <RowActions issue={row.original} />)]
        : []),
    ]),
    state: { rowSelection, expanded },
    onRowSelectionChange: setRowSelection,
    onExpandedChange: setExpanded,
    rowCount: ISSUES.length,
  });

  return (
    <DataTable
      table={table}
      stickyHeader
      bulkActions={
        withBulk ? (
          <>
            <Button variant="ghost" size="sm" icon={ResolveIcon}>
              Resolve
            </Button>
            <Button variant="ghost" size="sm" icon={DeleteIcon}>
              Delete
            </Button>
          </>
        ) : undefined
      }
      renderDetail={
        withDetail
          ? (row) => (
              <div className="px-4 py-3 text-meta text-fg-secondary">
                Last seen 3 minutes ago in {row.original.release}.
              </div>
            )
          : undefined
      }
      onRowClick={withDetail ? (row) => row.toggleExpanded() : undefined}
    />
  );
}

/**
 * The meta points at the harness rather than at `DataTable` itself: the shell
 * takes a built table instance as a required prop, so typing stories against it
 * would force every one of them to construct a table in `args` as well as in
 * `render`. Every prop here is optional, so the stories stay declarative.
 */
/**
 * The overflow that ends most rows. Base UI portals the popup, so it is not
 * clipped by the table's own scroll container.
 */
function RowActions({ issue }: { issue: Issue }) {
  return (
    <MenuRoot>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            icon={OverflowIcon}
            aria-label={`Actions for ${issue.id}`}
          />
        }
      />
      <MenuContent align="end">
        <MenuItem icon={ResolveIcon}>Resolve</MenuItem>
        <MenuItem icon={IgnoreIcon}>Ignore</MenuItem>
        <MenuItem icon={AssignIcon}>Assign to me</MenuItem>
        <MenuSeparator />
        <MenuItem tone="danger" icon={DeleteIcon}>
          Delete issue
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  );
}

const meta = {
  title: 'Components/DataTable',
  component: IssuesTable,
  parameters: { layout: 'padded', controls: { disable: true } },
} satisfies Meta<typeof IssuesTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <IssuesTable withActions />,
};

/**
 * The trailing overflow, which is how most rows end.
 *
 * The column is `actionsColumn`, so its width, its screen-reader-only header
 * and its `StopPropagation` are one decision rather than five tables' worth of
 * slightly different ones. Opening the menu inside a clickable row must not
 * also activate the row, and the popup must not be clipped by the table's
 * scroll box; both are pinned below.
 */
export const RowActionsMenu: Story = {
  render: () => <IssuesTable withActions withDetail />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);

    const trigger = canvas.getByRole('button', {
      name: 'Actions for CHECKOUT-API-4F2',
    });

    await userEvent.click(trigger);
    // Portalled, so it lands outside the canvas and one frame later.
    await waitFor(() =>
      expect(
        body.getByRole('menuitem', { name: 'Delete issue' }),
      ).toBeVisible(),
    );

    // The row also expands on click. If the trigger's event reached the row,
    // opening the menu would have opened the detail panel too.
    await expect(canvas.queryByText(/Last seen 3 minutes ago/)).toBeNull();

    // Portalled out of the table, so the scroll container cannot clip it.
    const menu = body.getByRole('menu');
    await expect(canvas.queryByRole('menu')).toBeNull();
    await expect(menu).toBeVisible();
  },
};

/**
 * One growing column takes the leftover width; the rest keep their pixel size.
 * The widths are computed in `sizing.ts` rather than left to the browser, which
 * under `table-fixed` would redistribute surplus across every column at once.
 */
export const Widths: Story = {
  render: () => <IssuesTable />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = canvas.getByRole('table');

    // Every column ends up with an explicit number, so the browser has no
    // distribution left to do.
    const style = table.getAttribute('style') ?? '';
    await expect(style).toContain('--col-issue-size');
    await expect(style).toContain('--col-events-size');
  },
};

/**
 * Most tables are lists you read, not sets you act on. Selection is opt-in, so
 * a table that has nothing to do in bulk does not carry a column of checkboxes
 * and a select-all that means nothing.
 */
export const WithoutSelection: Story = {
  render: () => <IssuesTable withActions />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.queryByRole('checkbox')).toBeNull();
    // The actions are still there: the two are unrelated decisions.
    await expect(
      canvas.getByRole('button', { name: 'Actions for CHECKOUT-API-4F2' }),
    ).toBeVisible();
  },
};

/**
 * Selecting rows swaps the column titles for the bulk actions in place, rather
 * than opening a bar above the table that would push everything down.
 */
export const BulkActions: Story = {
  render: () => <IssuesTable withSelection withBulk />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const [firstRowBox] = canvas.getAllByRole('checkbox', {
      name: 'Select row',
    });
    await userEvent.click(firstRowBox as HTMLElement);

    // The select-all box survives the swap: the action bar starts to its right
    // precisely so that ticking more rows stays possible.
    await expect(
      canvas.getByRole('checkbox', { name: 'Select all rows on this page' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Resolve' }),
    ).toBeInTheDocument();
  },
};

/**
 * The header box goes to `mixed` when only part of the page is selected. A
 * full tick there would be a claim about what pressing it does.
 */
export const PartialSelection: Story = {
  render: () => <IssuesTable withSelection withBulk />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [firstRowBox] = canvas.getAllByRole('checkbox', {
      name: 'Select row',
    });

    await userEvent.click(firstRowBox as HTMLElement);
    await expect(
      canvas.getByRole('checkbox', { name: 'Select all rows on this page' }),
    ).toHaveAttribute('aria-checked', 'mixed');
  },
};

/**
 * The disclosure lives on a real button, not on the `<tr>`.
 *
 * `aria-expanded` on a row is only defined inside a `treegrid`, and claiming
 * that role would promise a cell-by-cell arrow-key model this table does not
 * implement. The button is the row's one tab stop; clicking the row still
 * toggles it for pointer users.
 */
export const ExpandableRows: Story = {
  render: () => <IssuesTable withDetail />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const toggle = canvas.getAllByRole('button', {
      name: 'Show details',
    })[0] as HTMLElement;
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    toggle.focus();
    await userEvent.keyboard('{Enter}');

    await expect(
      canvas.getAllByRole('button', { name: 'Hide details' })[0],
    ).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText(/Last seen 3 minutes ago/)).toBeVisible();
  },
};

/** The header stays put and the table keeps its shape while a page loads. */
export const Pending: Story = {
  render: function Render() {
    const table = useAppTable({
      data: ISSUES,
      columns,
      rowCount: ISSUES.length,
    });
    return <DataTable table={table} isPending />;
  },
};

/**
 * The table stays when there is nothing in it. Its header is what says what was
 * being looked for and what a filter is hiding, which is when that is most
 * useful.
 */
export const Empty: Story = {
  render: function Render() {
    const table = useAppTable({ data: [], columns, rowCount: 0 });
    return (
      <DataTable
        table={table}
        empty={
          <p className="p-8 text-center text-body text-fg-muted">
            No unresolved issues.
          </p>
        }
      />
    );
  },
};

/** Paging renders nothing at all when there is only one page. */
export const WithPagination: Story = {
  render: function Render() {
    const [pagination, setPagination] = useState({
      pageIndex: 0,
      pageSize: 3,
    });
    const table = useAppTable({
      data: ISSUES,
      columns,
      state: { pagination },
      onPaginationChange: setPagination,
      rowCount: 42,
    });

    return (
      <div className="flex flex-col">
        <DataTable table={table} />
        <DataTablePagination table={table} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText(/of 42/)).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'First page' }),
    ).toBeDisabled();

    await userEvent.click(canvas.getByRole('button', { name: 'Next page' }));
    await expect(
      canvas.getByRole('button', { name: 'Previous page' }),
    ).toBeEnabled();
  },
};
