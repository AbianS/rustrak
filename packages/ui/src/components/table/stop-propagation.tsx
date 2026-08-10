/**
 * Keeps a control inside a clickable row to itself.
 *
 * The shell gives a row with `onRowClick` its own click handler and its own
 * Enter/Space handler. Without this, ticking a checkbox in such a row would
 * also activate the row: one gesture, two things happening, and only one of
 * them asked for.
 */
export function StopPropagation({ children }: { children: React.ReactNode }) {
  return (
    <div
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}
