import { ChevronRight } from 'lucide-react';
import { StopPropagation } from '@/components/stop-propagation';

/**
 * A collapsible, anchor-addressable content section (Sentry "group event
 * details" style). Uses a native `<details>` so it needs no client JS, and the
 * `id` lets the "Jump to" nav scroll straight to it.
 */
export function Section({
  id,
  title,
  defaultOpen = true,
  actions,
  children,
}: {
  id?: string;
  title: string;
  defaultOpen?: boolean;
  /** Right-aligned controls in the header (e.g. a "Copy as" dropdown). Clicks
   * here don't toggle the section, since `<summary>` normally intercepts them. */
  actions?: React.ReactNode;
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
        <span className="text-sm font-semibold flex-1">{title}</span>
        {actions && <StopPropagation>{actions}</StopPropagation>}
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}
