import { tv, type VariantProps } from '../../lib/tv';

/**
 * The figure that trails a label: 143 beside Issues, 12,4 K beside the Events
 * tab, 8 beside a menu entry.
 *
 * It is mono and it has no box. A count is machine text -- it changes on its
 * own while you are looking at the page -- and boxing it would make it compete
 * with the label it belongs to. Being mono is also what stops the sidebar from
 * twitching sideways every time a number gains a digit.
 *
 * Zero is not rendered. `count={0}` returns nothing at all, so no caller has to
 * remember to guard: an empty count reads as "there are none", which is exactly
 * the state that deserves no ink.
 */
const count = tv({
  base: 'shrink-0 font-mono text-mono-sm tabular-nums',
  variants: {
    tone: {
      default: 'text-fg-meta',
      muted: 'text-fg-ghost',
      strong: 'text-fg-muted',
      brand: 'text-fg-brand',
    },
  },
  defaultVariants: { tone: 'default' },
});

export interface CountProps extends VariantProps<typeof count> {
  /** Already formatted for the reader's locale: `1.208`, `12,4 K`. */
  children?: number | string | null;
  className?: string;
}

export function Count({ children, tone, className }: CountProps) {
  if (children == null || children === 0 || children === '') {
    return null;
  }

  return <span className={count({ tone, className })}>{children}</span>;
}

Count.displayName = 'Count';
