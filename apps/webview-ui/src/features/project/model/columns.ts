/**
 * Column widths, shared by the header row and the cells.
 *
 * Shared rather than written twice because a header and its cells drifting
 * apart is invisible in review and obvious on screen.
 *
 * Two kinds of column here, deliberately:
 *
 * - The three counters are **fixed width**, so they read as one tight block.
 *   Giving them a `flex-1` share each spreads them over ~150px apiece on a
 *   wide screen, and since their contents are right-aligned the numbers end
 *   up marooned from one another with no relationship left on screen.
 * - The name and the sparkline **absorb the slack**, because they are the
 *   only two cells that get better with more room. That also keeps the
 *   counters off the right edge, which is what made the original layout feel
 *   like everything had been shoved into a corner.
 */
export const PROJECT_COLUMNS = {
  name: 'flex-[3] min-w-0',
  issues: 'hidden sm:block w-20 shrink-0 text-right',
  events: 'hidden md:block w-24 shrink-0 text-right',
  total: 'hidden lg:block w-20 shrink-0 text-right',
  // `pl-6` on top of the row's `gap-4` opens a 40px gutter here. The counters
  // are one group and the chart is another; at the uniform 16px gap the
  // sparkline read as a fourth counter rather than as a separate thing.
  trend: 'hidden lg:block flex-[2] min-w-28 pl-6',
  created: 'hidden xl:block w-28 shrink-0 text-right',
} as const;
