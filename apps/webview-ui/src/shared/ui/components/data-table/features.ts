import {
  columnSizingFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  tableFeatures,
} from '@tanstack/react-table';

/**
 * What a column tells the shell beyond its width.
 *
 * Registered on the feature set rather than by declaration-merging the global
 * `ColumnMeta` interface: v9 resolves `columnMeta` from the features object
 * first, which keeps the type scoped to tables built with `useAppTable`
 * instead of every TanStack table anyone ever adds to the app.
 */
export interface DataTableColumnMeta {
  /**
   * Absorbs the width left over once the fixed columns have taken theirs.
   *
   * At most one column per table should set it.
   *
   * (Once `columnResizingFeature` is registered, dragging this column's handle
   * will stop the flag applying: an explicit entry in `columnSizing` wins over
   * `columnDef.size` inside `column.getSize()`, and the shell reads the same
   * state. That is the behaviour AG Grid and MUI DataGrid both settled on.
   * There is no handle to drag today.)
   */
  grow?: boolean;
  /** Aligns header and cells together, so the two cannot disagree. */
  align?: 'start' | 'end';
  /**
   * Drops the column below this breakpoint.
   *
   * Done in CSS rather than through `columnVisibility`, because the latter has
   * to measure the viewport in the browser and would render one set of columns
   * on the server and a different one after hydration. The shell feeds the
   * same breakpoint into its width arithmetic, so the two cannot disagree.
   */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
  /** Applied to both `<th>` and `<td>`, for anything the shell does not cover. */
  className?: string;
  /** Applied to the `<th>` only, for the rare header-specific override. */
  headerClassName?: string;
}

/**
 * The features every Rustrak table gets, and no others.
 *
 * v9 made features opt-in and tree-shakable, so this list is a bundle
 * decision, not just a config one. Nothing is registered speculatively:
 * sorting, filtering, resizing, pinning and grouping are all absent because
 * no table asks for them, and adding one later is a one-line change.
 *
 * `columnSizingFeature` stays without `columnResizingFeature`: it is what
 * gives a column `size`, `minSize` and `getSize()`, which the layout needs to
 * decide widths. Only the drag is gone.
 *
 * No row models are registered. Every table here renders exactly the page the
 * server returned; the client never derives rows. `rowExpandingFeature` is
 * included for its state and toggles only, since the shell's detail panel is
 * an extra row of markup rather than a sub-row of data.
 */
export const dataTableFeatures = tableFeatures({
  rowPaginationFeature,
  rowSelectionFeature,
  rowExpandingFeature,
  columnSizingFeature,
  columnMeta: {} as DataTableColumnMeta,
});

export type DataTableFeatures = typeof dataTableFeatures;
