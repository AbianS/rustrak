import type { LucideIcon } from 'lucide-react';
import { type IconComponent, type IconProps, iconVariants } from '../icon';

/**
 * Adapter from lucide-react to the `IconComponent` contract.
 *
 * With `lucide-symbols.ts` beside it, this directory is the only place in the
 * package that touches `lucide-react`. Switching icon library means writing
 * another adapter with this signature and another symbol list, and pointing
 * `icon-catalog.ts` at them; not one component finds out.
 *
 * The symbols live next door rather than here because a file that exports both
 * components and a factory is a file React Fast Refresh cannot preserve state
 * across (`react-doctor/only-export-components`).
 *
 * What it normalises:
 *   - size and stroke become tokens rather than library props;
 *   - the icon is decorative by default (`aria-hidden`), because it almost
 *     always sits beside text a screen reader already announces. Give it an
 *     `aria-label` and it becomes `role="img"` and is announced;
 *   - it is never reachable by tab.
 */
export function fromLucide(
  displayName: string,
  Source: LucideIcon,
): IconComponent {
  function Icon({ size, className, ...props }: IconProps) {
    const labelled = props['aria-label'] != null;

    return (
      <Source
        aria-hidden={labelled ? undefined : true}
        role={labelled ? 'img' : undefined}
        focusable="false"
        {...props}
        className={iconVariants({ size, className })}
      />
    );
  }

  Icon.displayName = displayName;

  return Icon;
}
