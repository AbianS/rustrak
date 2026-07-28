/**
 * Column widths, shared by the header row and the issue rows.
 *
 * Same reason `PROJECT_COLUMNS` exists: a header and its cells drifting apart
 * is invisible in review and obvious on screen. It had already started here.
 * The header painted Trend as `hidden lg:block w-16` and the row as
 * `hidden lg:flex w-16 justify-start`, so the two tracks agreed on the width
 * by coincidence rather than by construction.
 *
 * The row keeps `justify-start` of its own: the sparkline is the one cell that
 * lays out its content rather than just holding text, and that is a property
 * of the cell, not of the column.
 */
export const ISSUE_COLUMNS = {
  title: 'flex-1 min-w-0',
  trend: 'hidden lg:block w-16',
  age: 'hidden lg:block w-24 text-right',
  events: 'hidden sm:block w-24 text-right',
  users: 'hidden lg:block w-20 text-right',
  lastSeen: 'hidden sm:block w-36 text-right',
  /** Stands in for the row's actions menu so the header tracks line up. */
  actions: 'w-8',
} as const;
