import type { ComponentType, SVGProps } from 'react';

/**
 * The contract for a system icon.
 *
 * Today lucide draws them. Tomorrow it may not, and swapping it should not
 * touch twenty components. Hence the three layers:
 *
 *   icon.tsx             the contract: this type and the sizes
 *   adapters/lucide.tsx  the only file that imports lucide-react
 *   icon-catalog.ts      the product's own names: IssueIcon, ResolveIcon...
 *
 * Components import from the catalog, never from the library. The name says
 * what the icon **means**, not what it draws, so changing the glyph does not
 * force a change on anyone using it. Changing library is writing another
 * adapter with this same signature and repointing the catalog.
 */
export type IconSize = 'sm' | 'md' | 'lg';

export interface IconProps
  extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height' | 'ref'> {
  /**
   * A system size. Not a number: the three values come from `--spacing-icon-*`
   * and are the only ones the design uses.
   */
  size?: IconSize;
}

export type IconComponent = ComponentType<IconProps>;

/**
 * Size is applied with a class, not with the `width`/`height` attributes the
 * library paints into the SVG. A Tailwind utility beats those attributes, so
 * the adapter does not depend on the library accepting any particular prop.
 */
export const iconSizes: Record<IconSize, string> = {
  sm: 'size-icon-sm',
  md: 'size-icon-md',
  lg: 'size-icon-lg',
};
