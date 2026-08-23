import { Separator as BaseSeparator } from '@base-ui/react/separator';
import { tv, type VariantProps } from '../../lib/tv';
import type { WithClassName } from '../../lib/types';

/**
 * A rule.
 *
 * `tone` exists because this product stacks three surfaces and a divider has to
 * be read against whichever one it lands on: `divider` is the hairline between
 * rows of a list, `default` separates blocks on a panel, `strong` closes a
 * region off.
 */
const separator = tv({
  base: 'shrink-0',
  variants: {
    orientation: {
      horizontal: 'h-px w-full',
      vertical: 'h-full w-px',
    },
    tone: {
      divider: 'bg-border-divider',
      default: 'bg-border-subtle',
      strong: 'bg-border',
    },
  },
  defaultVariants: { orientation: 'horizontal', tone: 'default' },
});

export interface SeparatorProps
  extends WithClassName<BaseSeparator.Props>,
    Pick<VariantProps<typeof separator>, 'tone'> {}

export function Separator({
  orientation = 'horizontal',
  tone,
  className,
  ...props
}: SeparatorProps) {
  return (
    <BaseSeparator
      orientation={orientation}
      className={separator({ orientation, tone, className })}
      {...props}
    />
  );
}

Separator.displayName = 'Separator';
