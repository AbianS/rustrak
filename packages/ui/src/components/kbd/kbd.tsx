import type { ReactNode } from 'react';
import { tv, type VariantProps } from '../../lib/tv';

/**
 * A keyboard shortcut, shown next to the thing it triggers: `⌘K` in the global
 * search, `Esc` at the foot of a filter panel.
 *
 * No key cap, no border, no box. The shortcut is always inside
 * something that already has an edge -- a search field, a menu row, a popup
 * footer -- and drawing a second frame inside the first one made a search box
 * look like it contained a button. What separates the shortcut from the label
 * is the mono face and the drop in contrast, which is enough because a shortcut
 * is read once and then remembered.
 */
const kbd = tv({
  base: 'shrink-0 font-mono text-kbd whitespace-nowrap',
  variants: {
    tone: {
      default: 'text-fg-placeholder',
      muted: 'text-fg-meta',
      'on-brand': 'text-fg-on-brand/70',
    },
  },
  defaultVariants: { tone: 'default' },
});

export interface KbdProps extends VariantProps<typeof kbd> {
  children: ReactNode;
  className?: string;
}

export function Kbd({ tone, className, children }: KbdProps) {
  return <kbd className={kbd({ tone, className })}>{children}</kbd>;
}

Kbd.displayName = 'Kbd';
