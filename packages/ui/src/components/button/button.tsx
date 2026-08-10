import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type { ReactNode } from 'react';
import { focusRing } from '../../lib/focus';
import {
  interactiveTransition,
  pressScale,
  pressScaleSmall,
} from '../../lib/motion';
import { tv, type VariantProps } from '../../lib/tv';
import type { IconComponent } from '../icon/icon';
import { ChevronDownIcon, SpinnerIcon } from '../icon/icon-catalog';

/**
 * The system button.
 *
 * The five variants come from `Rustrak Rediseno v5` and are not
 * interchangeable:
 *
 *   primary    lime. One per screen: the action that settles whatever is being
 *              looked at (Resolve, Save changes, Create project);
 *   secondary  the alternative beside it, with a surface of its own;
 *   ghost      hairline only, no surface. The default weight of a full toolbar;
 *   danger     destructive. Tinted at 10%, never solid red: a solid red button
 *              in an action bar gets pressed before it gets read;
 *   dashed     the design's dashed hairline, for "add another one". It marks a
 *              gap to be filled, not an action on something that exists.
 *
 * **The hairline uses `inset-ring`, not `border`.** The design contains not one
 * `border`: every hairline is `box-shadow: inset 0 0 0 1px`. A real border
 * joins the box and shifts content when it appears on hover; an inset ring is
 * painted on top and moves nothing, so a row of buttons does not relayout when
 * the pointer crosses one of them.
 *
 * The label never wraps to two lines and the button never shrinks: that is why
 * `shrink-0` and `whitespace-nowrap` sit in the base and are not optional.
 */
const button = tv({
  base: [
    'relative inline-flex shrink-0 items-center justify-center',
    'gap-2 whitespace-nowrap select-none',
    'disabled:pointer-events-none',
    // Pressing is not just a lightening: the button sinks. That is the signal
    // separating "I pressed it" from "it went to hover as I passed over".
    interactiveTransition,
    pressScale,
    // Disabled and loading do not sink: nothing happened worth celebrating.
    'disabled:active:scale-100',
    focusRing,
  ],
  variants: {
    variant: {
      primary: [
        'bg-surface-brand text-fg-on-brand font-semibold',
        'hover:bg-surface-brand-hover',
        'disabled:bg-surface-disabled disabled:text-fg-disabled',
      ],
      secondary: [
        'bg-surface-active text-fg inset-ring inset-ring-border-control',
        'hover:inset-ring-border-raised',
        'disabled:bg-surface-disabled disabled:text-fg-disabled',
        'disabled:inset-ring-border',
      ],
      ghost: [
        'text-fg-secondary inset-ring inset-ring-border-subtle',
        'hover:bg-surface-hover hover:text-fg',
        'disabled:text-fg-disabled disabled:inset-ring-border',
      ],
      danger: [
        'bg-surface-error text-fg-error inset-ring inset-ring-border-danger',
        'hover:bg-surface-fatal hover:text-fg-fatal',
        'disabled:bg-surface-disabled disabled:text-fg-disabled',
        'disabled:inset-ring-border',
      ],
      dashed: [
        'text-fg-muted',
        // `inset-ring` is a box-shadow and takes no `border-style`, so the
        // dashed hairline is drawn by a real border. It is the system's one
        // exception, and it is safe here because this variant never gains or
        // loses the border on hover: only its colour changes, so nothing moves.
        'border border-dashed border-border-strong',
        'hover:border-border-raised hover:text-fg-secondary',
        'disabled:border-border disabled:text-fg-disabled',
      ],
    },
    size: {
      sm: 'h-control-sm rounded-md px-2.75 text-control-sm',
      md: 'h-control-md rounded-lg px-3 text-control',
      lg: 'h-control-lg rounded-lg px-3.75 text-control',
    },
    /** No label: the button becomes square and demands an `aria-label`. */
    iconOnly: { true: 'px-0' },
    /**
     * "This action is on right now": a filter applied, a panel open. It is not
     * focus and it is not hover.
     *
     * Only meaningful on `ghost`. A primary is already the screen's main
     * action: it cannot also be "active".
     */
    selected: { true: '' },
    loading: { true: 'pointer-events-none' },
  },
  compoundVariants: [
    { iconOnly: true, size: 'sm', class: 'w-control-sm' },
    { iconOnly: true, size: 'md', class: 'w-control-md' },
    { iconOnly: true, size: 'lg', class: 'w-control-lg' },
    // The small square sinks further, so the gesture reads the same.
    { iconOnly: true, size: 'sm', class: pressScaleSmall },
    {
      variant: 'ghost',
      selected: true,
      class: 'bg-surface-selected text-fg-brand inset-ring-border-brand',
    },
  ],
  defaultVariants: { variant: 'ghost', size: 'md' },
});

export type ButtonVariant = NonNullable<VariantProps<typeof button>['variant']>;
export type ButtonSize = NonNullable<VariantProps<typeof button>['size']>;

interface ButtonOwnProps
  extends Omit<useRender.ComponentProps<'button'>, 'children'>,
    Omit<VariantProps<typeof button>, 'iconOnly'> {
  /** Icon to the left of the label. */
  icon?: IconComponent;
  /**
   * Marks the button as a folder: it runs nothing, it opens a menu. Draws the
   * chevron on the right.
   */
  menu?: boolean;
  /** Replaces the icon with a spinner and blocks interaction. */
  loading?: boolean;
}

/**
 * A button with no label is required to carry `aria-label`, and the type
 * enforces it: in the design the icon-only version always comes with a tooltip,
 * and with no accessible name there is nothing to announce. `<Button icon={X} />`
 * without a name does not get past `tsc`.
 */
export type ButtonProps = ButtonOwnProps &
  (
    | { children: ReactNode; 'aria-label'?: string }
    | { children?: undefined; 'aria-label': string }
  );

export function Button({
  variant,
  size,
  selected,
  loading,
  icon: Icon,
  menu,
  className,
  render,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const iconOnly = children == null;
  const iconSize = size === 'sm' ? 'sm' : 'md';
  const LeadingIcon = loading ? SpinnerIcon : Icon;

  return useRender({
    defaultTagName: 'button',
    render,
    props: mergeProps<'button'>(
      {
        type: 'button',
        disabled: disabled || loading,
        'aria-busy': loading || undefined,
        className: button({
          variant,
          size,
          selected,
          loading,
          iconOnly,
          className,
        }),
        children: (
          <>
            {LeadingIcon ? (
              <LeadingIcon
                size={iconSize}
                className={loading ? 'animate-spin' : undefined}
              />
            ) : null}
            {children}
            {menu ? (
              <ChevronDownIcon size="sm" className="text-fg-ghost" />
            ) : null}
          </>
        ),
      },
      props,
    ),
  });
}

Button.displayName = 'Button';
