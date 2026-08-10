import { Tooltip as Base } from '@base-ui/react/tooltip';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { popTransition } from '../../lib/motion';

/**
 * The name of a control that has no visible label.
 *
 * Not a general annotation layer. An icon-only button in this system is
 * *required* to carry an `aria-label`, so a tooltip is what makes that name
 * visible to people who are not using a screen reader; it is not what supplies
 * it. Hover is not an interaction everyone has, so a tooltip must never be the
 * only place something is said.
 *
 * `Tooltip.Provider` is deliberately not exported. Base UI uses it to share the
 * "one has opened recently, so open the next one instantly" timer, and the
 * application mounts exactly one at its root. Exposing it here would invite a
 * second provider somewhere down the tree, which silently splits that timer and
 * makes a toolbar feel inconsistent as the pointer crosses it.
 */
export interface TooltipProps {
  /** The control being named. Must be a single focusable element. */
  children: ReactNode;
  /** What the control does. Short: this is a name, not documentation. */
  content: ReactNode;
  /** @default 'top' */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /**
   * How long the pointer must rest before it opens.
   *
   * 600ms is Base UI's default and it is kept: shorter turns a toolbar into a
   * flicker as the pointer crosses it on the way somewhere else.
   */
  delay?: number;
  /** Suppresses the tooltip without unmounting the trigger. */
  disabled?: boolean;
}

export function Tooltip({
  children,
  content,
  side = 'top',
  delay,
  disabled,
}: TooltipProps) {
  return (
    <Base.Root disabled={disabled}>
      <Base.Trigger delay={delay} render={children as React.ReactElement} />
      <Base.Portal>
        <Base.Positioner side={side} sideOffset={6}>
          <Base.Popup
            className={cn(
              'rounded-md bg-surface-floating px-2 py-1',
              'text-control-sm text-fg-secondary',
              'shadow-overlay inset-ring inset-ring-border-subtle',
              // Grows from the trigger rather than from its own centre, which
              // is what ties the panel to the thing that opened it.
              popTransition,
            )}
          >
            {content}
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  );
}

Tooltip.displayName = 'Tooltip';

/**
 * Mount once, at the application root.
 *
 * Exported separately from `Tooltip` so that the one-per-app rule is visible in
 * the import rather than implied.
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <Base.Provider>{children}</Base.Provider>;
}

TooltipProvider.displayName = 'TooltipProvider';
