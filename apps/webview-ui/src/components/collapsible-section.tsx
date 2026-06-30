import { ChevronRight } from 'lucide-react';

/**
 * A collapsible, anchor-addressable content section (Sentry "group event
 * details" style). Uses a native `<details>` so it needs no client JS, and the
 * `id` lets the "Jump to" nav scroll straight to it.
 */
export function Section({
  id,
  title,
  defaultOpen = true,
  children,
}: {
  id?: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="group border-b last:border-b-0 scroll-mt-4"
    >
      <summary className="flex cursor-pointer list-none select-none items-center gap-2 py-3 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
        <span className="text-sm font-semibold">{title}</span>
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}
