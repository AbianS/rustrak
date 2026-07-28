'use client';

/**
 * Wraps interactive children (e.g. a "Copy as" dropdown) placed inside a
 * clickable header — like `<Section>`'s `<summary>` — so clicking them
 * doesn't also trigger the parent's own click handling.
 *
 * Needs its own `'use client'` boundary: `<Section>` itself isn't a Client
 * Component (it's rendered straight from Server Components), and raw event
 * handlers can't be attached to elements rendered on the server.
 */
export function StopPropagation({ children }: { children: React.ReactNode }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
