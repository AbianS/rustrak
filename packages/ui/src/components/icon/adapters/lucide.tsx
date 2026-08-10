import type { LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { type IconComponent, type IconProps, iconSizes } from '../icon';

/**
 * The only file in the package allowed to import `lucide-react`.
 *
 * It wraps a lucide glyph in the system's contract: translates `size` into the
 * token utility and marks the SVG with `data-icon`, which is how
 * `styles/base.css` imposes the stroke width on it. Lucide draws at 2px, which
 * looks heavy next to Onest at this system's sizes (13-16px).
 */
export function fromLucide(Glyph: LucideIcon): IconComponent {
  function Icon({ size = 'md', className, ...props }: IconProps) {
    return (
      <Glyph
        data-icon=""
        aria-hidden="true"
        focusable="false"
        className={cn('shrink-0', iconSizes[size], className)}
        {...props}
      />
    );
  }

  Icon.displayName = `Icon(${Glyph.displayName ?? 'lucide'})`;
  return Icon;
}
