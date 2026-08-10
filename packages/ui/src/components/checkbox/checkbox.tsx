import { Checkbox as Base } from '@base-ui/react/checkbox';
import { cn } from '../../lib/cn';
import { focusRing } from '../../lib/focus';
import { interactiveTransition, pressScaleSmall } from '../../lib/motion';
import { tv } from '../../lib/tv';
import { PartialIcon, ResolveIcon } from '../icon/icon-catalog';

/**
 * A box that is on, off, or partly on.
 *
 * The third state is the one worth getting right. A header checkbox over
 * twelve rows with one ticked is not checked and not unchecked, and drawing a
 * full tick there is a lie about what pressing it will do. Base UI reports it
 * as `aria-checked="mixed"` and hands out `data-indeterminate`; the box fills
 * the same way a checked one does and swaps the tick for a dash, so the two
 * states are told apart by the mark rather than by the fill.
 *
 * State is read from the DOM throughout. There is no `isChecked` prop being
 * threaded into class names, so the visual and the announced state cannot
 * disagree.
 */
const checkbox = tv({
  base: [
    'inline-flex size-choice shrink-0 items-center justify-center',
    'rounded-xs bg-surface-sunken inset-ring inset-ring-border-control',
    'text-fg-on-brand',
    interactiveTransition,
    pressScaleSmall,
    'hover:inset-ring-border-raised',
    'data-checked:bg-surface-brand data-checked:inset-ring-surface-brand',
    'data-indeterminate:bg-surface-brand',
    'data-indeterminate:inset-ring-surface-brand',
    'data-disabled:bg-surface-disabled data-disabled:text-fg-disabled',
    'data-disabled:inset-ring-border data-disabled:pointer-events-none',
    focusRing,
  ],
});

export interface CheckboxProps extends React.ComponentProps<typeof Base.Root> {}

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <Base.Root className={cn(checkbox(), className)} {...props}>
      <Base.Indicator
        // `keepMounted` is off: the indicator only exists while the box is on
        // or mixed, so there is no hidden icon to fight over.
        render={(indicatorProps, state) => (
          <span {...indicatorProps}>
            {state.indeterminate ? (
              <PartialIcon size="sm" />
            ) : (
              <ResolveIcon size="sm" />
            )}
          </span>
        )}
      />
    </Base.Root>
  );
}

Checkbox.displayName = 'Checkbox';
