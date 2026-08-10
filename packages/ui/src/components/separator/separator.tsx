import { cn } from '../../lib/cn';
import { tv, type VariantProps } from '../../lib/tv';

/**
 * A division between two things.
 *
 * Two shapes, because the design uses two and they mean different things. The
 * `line` separates blocks. The `dot` separates two pieces of meta on one line
 * ("web@2026.8.1 · 3 min ago"), and at 3px it reads as punctuation rather than
 * as a bullet.
 *
 * Both are decorative by default: a rule that repeats what the layout already
 * says is noise in a screen reader. Pass `decorative={false}` only when the
 * separator is genuinely the only thing marking a boundary.
 */
const separator = tv({
  base: 'shrink-0 bg-border',
  variants: {
    shape: {
      line: '',
      dot: 'size-dot-sm rounded-pill bg-border-raised',
    },
    orientation: {
      horizontal: '',
      vertical: '',
    },
  },
  compoundVariants: [
    { shape: 'line', orientation: 'horizontal', class: 'h-px w-full' },
    // `self-stretch` rather than `h-full`: in a flex row the parent has no
    // resolved height for a percentage to resolve against, so `h-full` collapses
    // to nothing and the rule silently disappears.
    { shape: 'line', orientation: 'vertical', class: 'w-px self-stretch' },
  ],
  defaultVariants: { shape: 'line', orientation: 'horizontal' },
});

export interface SeparatorProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>,
    VariantProps<typeof separator> {
  /** @default true */
  decorative?: boolean;
}

export function Separator({
  shape,
  orientation = 'horizontal',
  decorative = true,
  className,
  ...props
}: SeparatorProps) {
  return (
    <div
      // `separator` with an orientation is the only role that carries the
      // meaning; `none` removes it from the tree entirely rather than leaving a
      // generic element for a screen reader to trip over.
      //
      // The aria props are spread rather than written with an `undefined`
      // branch, because `aria-orientation` is not a valid property of
      // `role="none"`: on a decorative rule the attribute has to be absent, not
      // present and empty.
      {...(decorative
        ? { role: 'none' as const }
        : {
            role: 'separator' as const,
            'aria-orientation': orientation,
          })}
      className={cn(separator({ shape, orientation }), className)}
      {...props}
    />
  );
}

Separator.displayName = 'Separator';
