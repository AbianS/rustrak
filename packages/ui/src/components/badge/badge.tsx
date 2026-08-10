import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { tv, type VariantProps } from '../../lib/tv';

/**
 * A short, fixed label: an issue identifier, a release, a count, a state.
 *
 * Always monospaced, because everything a badge carries in this product is a
 * value you compare against another one. `CHECKOUT-API-4F2` next to
 * `CHECKOUT-API-3B1` only reads as two different things when the glyphs line up.
 *
 * The tones are the severity scale plus two neutrals, and they are not
 * decoration: `brand` is the lime fill and is reserved for a count that is the
 * point of the screen. A badge on every row in lime is a screen with no accent.
 */
const badge = tv({
  base: [
    'inline-flex shrink-0 items-center justify-center',
    'rounded-sm px-2 py-0.5',
    'font-mono text-badge whitespace-nowrap',
  ],
  variants: {
    tone: {
      /** The default: a hairline, no fill. Reads as a value, not as an alert. */
      neutral: 'text-fg-tertiary inset-ring inset-ring-border-subtle',
      /** Filled lime. One per screen at most. */
      brand: 'bg-surface-brand text-fg-on-brand',
      /** A filled neutral, for a count that needs weight without alarm. */
      solid: 'bg-surface-active text-fg-secondary',
      fatal: 'bg-surface-fatal text-fg-fatal',
      error: 'bg-surface-error text-fg-error',
      warning: 'bg-surface-warning text-fg-warning',
      info: 'bg-surface-info text-fg-info',
      /*
       * `debug` is the one severity whose own foreground cannot be used here.
       * `--fg-debug` on `--surface-debug` measures 2.51:1, because the level is
       * deliberately the dimmest in the palette and its tint is built from the
       * same colour. That is fine for a mark or for recessive text, and
       * unreadable for a label in a chip. `--fg-tertiary` gives 5.94:1 and is
       * still the quietest of the five badges. Pinned in `styles/contrast.test.ts`.
       */
      debug: 'bg-surface-debug text-fg-tertiary',
    },
    /**
     * Uppercase, wider tracking, smaller. This is the FATAL / ERROR / NEW form,
     * as opposed to the identifier form which stays as written.
     *
     * It is a variant rather than a separate component because the box is
     * identical; only the text inside is set differently.
     */
    tag: { true: 'text-tag uppercase' },
  },
  defaultVariants: { tone: 'neutral' },
});

export type BadgeTone = NonNullable<VariantProps<typeof badge>['tone']>;

export interface BadgeProps
  extends useRender.ComponentProps<'span'>,
    VariantProps<typeof badge> {}

export function Badge({ tone, tag, className, render, ...props }: BadgeProps) {
  return useRender({
    defaultTagName: 'span',
    render,
    props: mergeProps<'span'>(
      { className: badge({ tone, tag, className }) },
      props,
    ),
  });
}

Badge.displayName = 'Badge';
