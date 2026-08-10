import type { RowData } from '@tanstack/react-table';
import { type RefObject, useLayoutEffect, useState } from 'react';
import type { DataTableInstance } from './use-app-table';

/**
 * The breakpoint below which a column is not rendered.
 *
 * Hiding is done in CSS, not through `columnVisibility`, so it resolves before
 * the first paint instead of after a measurement. The cost is that JavaScript
 * cannot see which columns are on screen, and the width arithmetic below needs
 * to. That is what `useVisibleTiers` is for: the class list and the arithmetic
 * read the same breakpoint, so they cannot drift.
 */
export type HideBelow = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Static class strings, because Tailwind cannot see a class it has to compute.
 * `table-cell` rather than `block` so the cell keeps participating in the
 * table's column layout when it comes back.
 */
export const HIDE_BELOW_CLASS: Record<HideBelow, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

/** Tailwind's own values. Keep in step with the class map above. */
const MIN_WIDTH_PX: Record<HideBelow, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};

const TIERS: readonly HideBelow[] = ['sm', 'md', 'lg', 'xl'];

/** Reads the breakpoints straight from the browser. */
function measureTiers(): ReadonlySet<HideBelow> {
  const visible = new Set<HideBelow>();
  for (const tier of TIERS) {
    if (window.matchMedia(`(min-width: ${MIN_WIDTH_PX[tier]}px)`).matches) {
      visible.add(tier);
    }
  }
  return visible;
}

/**
 * Which `hideBelow` tiers are currently on screen.
 *
 * Measured in the initialiser rather than defaulted to "all of them" and
 * corrected on mount. That correction existed because this table used to render
 * on a server, where there is no viewport to ask; here there always is one, so
 * the very first render is already right and a narrow viewport never lays out
 * as though it were wide.
 */
export function useVisibleTiers(): ReadonlySet<HideBelow> {
  const [visible, setVisible] = useState<ReadonlySet<HideBelow>>(measureTiers);

  useLayoutEffect(() => {
    const queries = TIERS.map(
      (tier) =>
        [
          tier,
          window.matchMedia(`(min-width: ${MIN_WIDTH_PX[tier]}px)`),
        ] as const,
    );

    const sync = () => {
      setVisible((previous) => {
        const next = new Set<HideBelow>();
        for (const [tier, query] of queries) {
          if (query.matches) next.add(tier);
        }
        // Same membership means the same layout; returning `previous` keeps
        // the table from re-rendering on unrelated viewport changes.
        if (
          next.size === previous.size &&
          [...next].every((tier) => previous.has(tier))
        ) {
          return previous;
        }
        return next;
      });
    };

    // No initial `sync()`: the initialiser already measured, and calling it
    // here would be a second render on every mount for no change.
    // One controller owns every listener, so the cleanup cannot fall out of
    // step with the loop that registered them.
    const controller = new AbortController();
    for (const [, query] of queries) {
      query.addEventListener('change', sync, { signal: controller.signal });
    }
    return () => controller.abort();
  }, []);

  return visible;
}

/** The width of the box the table has to lay itself out in. */
function useAvailableWidth(container: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;

    // Measured before paint, so the first frame is already correct rather than
    // showing default widths and snapping.
    setWidth(element.clientWidth);

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [container]);

  return width;
}

export interface ColumnLayout {
  /** Every visible leaf column's width in pixels, keyed by column id. */
  widths: ReadonlyMap<string, number>;
  /** What the columns add up to. Wider than the container means scrolling. */
  totalWidth: number;
  /**
   * Width of the inert trailing column, when the real ones do not reach the
   * end of the container.
   *
   * This is a table with no growing column: without it the rows would stop
   * short of the container's own border and the table would look truncated.
   */
  fillerWidth: number;
}

/**
 * Every column's width, in pixels, decided here rather than by the browser.
 *
 * ## Why this is not CSS
 *
 * The obvious version of this is `table-layout: fixed`, pixel widths on the
 * fixed columns, `width: auto` on the growing one, and a `min-width` on the
 * table. It very nearly works, and then does not: under fixed layout, when the
 * declared widths add up to less than the table's own width, the browser
 * distributes the surplus **across every column**. So the moment a growing
 * column is pinned by a resize, nothing is left to absorb the slack and every
 * other column silently inflates. Widths stop meaning anything.
 *
 * So the distribution is done here: fixed columns take their `size`, growing
 * columns split whatever is left down to their `minSize`, and every column
 * ends up with an explicit number. The browser is left with no distribution to
 * do, which is the only way to be sure it does none.
 *
 * A table whose columns are all fixed renders at their total and does not
 * stretch. Filling the container is what `meta.grow` is for, and guessing at
 * it -- stretching the last column, say -- would make a right-aligned final
 * column behave differently from every other table.
 */
export function useColumnLayout<TData extends RowData>(
  table: DataTableInstance<TData>,
  container: RefObject<HTMLElement | null>,
  visibleTiers: ReadonlySet<HideBelow>,
): ColumnLayout {
  const available = useAvailableWidth(container);

  const widths = new Map<string, number>();
  const growing: { id: string; floor: number }[] = [];
  let fixedTotal = 0;

  for (const column of table.getAllLeafColumns()) {
    const meta = column.columnDef.meta;

    // Hidden at this breakpoint: still given a width, because CSS is what
    // hides it and the two could be a frame apart, but it claims no space.
    // Every column is a leaf here; nothing in this app hides one by state.
    if (meta?.hideBelow && !visibleTiers.has(meta.hideBelow)) {
      widths.set(column.id, column.getSize());
      continue;
    }

    if (meta?.grow) {
      growing.push({ id: column.id, floor: column.columnDef.minSize ?? 0 });
    } else {
      const size = column.getSize();
      widths.set(column.id, size);
      fixedTotal += size;
    }
  }

  if (growing.length > 0) {
    const leftover = Math.max(0, available - fixedTotal);
    const share = Math.floor(leftover / growing.length);
    growing.forEach((column, index) => {
      // The last one takes the rounding remainder, so the columns add up to
      // the container exactly and no hairline gap opens on the right.
      const isLast = index === growing.length - 1;
      const width = isLast ? leftover - share * (growing.length - 1) : share;
      widths.set(column.id, Math.max(column.floor, width));
    });
  }

  let totalWidth = 0;
  for (const column of table.getAllLeafColumns()) {
    const meta = column.columnDef.meta;
    if (meta?.hideBelow && !visibleTiers.has(meta.hideBelow)) continue;
    totalWidth += widths.get(column.id) ?? 0;
  }

  return {
    widths,
    totalWidth,
    // Zero before the first measurement, so nothing is drawn on a guess.
    fillerWidth: available > 0 ? Math.max(0, available - totalWidth) : 0,
  };
}
