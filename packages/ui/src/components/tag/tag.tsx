import type { ReactNode } from 'react';
import { tv, type VariantProps } from '../../lib/tv';

/**
 * A status label: ERROR, FATAL, REGRESSION, STABLE, Owner.
 *
 * It defaults to plain coloured text with no box, and that is a settled
 * decision: an issue list is already a grid of rows and rules, and
 * putting a filled pill on every row turned severity into confetti. The colour
 * plus the uppercase mono setting is enough to read it as a label rather than
 * as prose, and it costs no width.
 *
 * `soft` brings the tinted background back for the one case that needs it: a
 * label sitting on its own, away from a column of its peers -- a role beside a
 * member's name, a state on a release card -- where there is nothing nearby to
 * read it against.
 *
 * The tone never carries the meaning alone. Every tag is a word, and the word
 * survives the colour being unavailable.
 */
const tag = tv({
  base: 'inline-flex shrink-0 items-center font-mono text-tag uppercase',
  variants: {
    tone: {
      error: 'text-sev-error-fg',
      warning: 'text-sev-warning-fg',
      info: 'text-sev-info-fg',
      brand: 'text-fg-brand',
      neutral: 'text-fg-tertiary',
    },
    variant: {
      text: '',
      soft: 'h-5 rounded-xs px-1.5',
    },
  },
  compoundVariants: [
    { variant: 'soft', tone: 'error', class: 'bg-sev-error-surface' },
    { variant: 'soft', tone: 'warning', class: 'bg-sev-warning-surface' },
    { variant: 'soft', tone: 'info', class: 'bg-sev-info-surface' },
    { variant: 'soft', tone: 'brand', class: 'bg-success-surface' },
    { variant: 'soft', tone: 'neutral', class: 'bg-surface-chip' },
  ],
  defaultVariants: { tone: 'neutral', variant: 'text' },
});

export type TagTone = NonNullable<VariantProps<typeof tag>['tone']>;

export interface TagProps extends VariantProps<typeof tag> {
  children: ReactNode;
  className?: string;
}

export function Tag({ tone, variant, className, children }: TagProps) {
  return <span className={tag({ tone, variant, className })}>{children}</span>;
}

Tag.displayName = 'Tag';
