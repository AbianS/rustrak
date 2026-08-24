import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { focusRing } from '../../lib/focus';
import { interactiveTransition } from '../../lib/motion';
import { tv } from '../../lib/tv';
import { RemoveIcon, ResolveIcon } from '../icon/icon-catalog';

/**
 * A checkbox, in the one size the product uses: 14 px, sized to sit in a 48 px
 * table row without becoming the row's subject.
 *
 * The palette named its colours before this component existed: `border-control`
 * is documented in `tokens.css` as "an empty checkbox", and the ticked state is
 * `surface-brand` with `fg-on-brand` -- the same lime-on-ink pair as the
 * primary button, because ticking a row is the same kind of statement as
 * pressing one.
 *
 * Indeterminate is drawn as a minus and only ever appears on a select-all
 * header: it is not a third state a user can ask for, it is the header
 * reporting that the page below it is split.
 */
const checkbox = tv({
  slots: {
    root: [
      'flex size-3.5 shrink-0 items-center justify-center',
      'rounded-xs border border-border-control bg-transparent',
      'hover:border-border-strong',
      'data-checked:border-surface-brand data-checked:bg-surface-brand',
      'data-indeterminate:border-surface-brand data-indeterminate:bg-surface-brand',
      'data-disabled:border-border-subtle data-disabled:bg-surface-disabled',
      interactiveTransition,
      focusRing,
    ],
    /*
     * The mark pops in from 50 % rather than fading: at 10 px a fade reads as
     * the ink arriving late, while the scale reads as the tick being made. On
     * the way out Base UI unmounts it immediately, which is right -- an untick
     * is a retraction, and a retraction that lingers looks contested.
     */
    indicator: [
      'flex text-fg-on-brand',
      'transition-[opacity,scale] duration-instant ease-entrance',
      'data-starting-style:scale-50 data-starting-style:opacity-0',
    ],
  },
});

const styles = checkbox();

export interface CheckboxProps
  extends Omit<BaseCheckbox.Root.Props, 'className'> {
  /**
   * What ticking it means. Required: the box never carries visible text, so
   * without this a screen reader announces "checkbox" and nothing else.
   */
  'aria-label': string;
  className?: string;
}

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <BaseCheckbox.Root className={styles.root({ className })} {...props}>
      <BaseCheckbox.Indicator className={styles.indicator()}>
        {props.indeterminate ? (
          <RemoveIcon size="sm" aria-hidden="true" />
        ) : (
          <ResolveIcon size="sm" aria-hidden="true" />
        )}
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
}

Checkbox.displayName = 'Checkbox';
