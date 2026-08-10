import {
  createTableHook,
  type ReactTable,
  type RowData,
} from '@tanstack/react-table';
import { dataTableFeatures } from './features';

/**
 * The one place a Rustrak table is configured.
 *
 * `createTableHook` is the v9 API for exactly this: features, defaults and
 * option choices are declared once, and a table then only has to name its
 * columns and its data. Everything below is a decision no individual table
 * should be re-making.
 *
 * Components are deliberately **not** registered here. `createTableHook` can
 * pre-bind cell/header/table components onto the instance, but that makes the
 * hook module import the components and the components import the hook, and
 * this codebase reads better with every import naming the file it wants.
 * `ColumnHeader` and the rest take the header or table as a prop instead.
 */
export const { useAppTable, createAppColumnHelper } = createTableHook({
  features: dataTableFeatures,

  /**
   * `size` is the fixed width in pixels and `minSize` the floor a growing
   * column will not go below. 150 is TanStack's own default, kept so an
   * unconfigured column is visibly unconfigured rather than subtly wrong.
   */
  defaultColumn: { size: 150, minSize: 60, maxSize: 800 },

  /**
   * The server does the work. Without this the table would quietly re-paginate
   * the single page it was handed, which looks like it works until the result
   * set is larger than `per_page`.
   *
   * There is no `manualSorting` or `manualFiltering` because neither feature
   * is registered: ordering and filtering are query parameters the server
   * reads, and the table never sees them.
   */
  manualPagination: true,
  manualExpanding: true,

  /**
   * Every row can open its detail panel.
   *
   * TanStack's default asks whether a row has sub-rows, which is the right
   * question for a tree and the wrong one here: the shell's detail panel is a
   * disclosure about the row itself, and no table in this app has sub-rows.
   * Left at the default, `toggleExpanded` returns without doing anything and
   * the row simply never opens.
   *
   * Whether a table expands at all is decided by whether it passes
   * `renderDetail` to the shell, not by the shape of its data.
   */
  getRowCanExpand: () => true,
});

/**
 * A table instance as the shell and its parts accept it.
 *
 * Left on the default `TSelected`, which is the full table state, because the
 * shell reads `table.state.columnSizing` to lay itself out. Tables that pass a
 * narrowing selector to `useAppTable` would not be assignable here, and none
 * do: the selector is for subscribing a leaf of the tree, not the shell.
 */
export type DataTableInstance<TData extends RowData> = ReactTable<
  typeof dataTableFeatures,
  TData
>;
