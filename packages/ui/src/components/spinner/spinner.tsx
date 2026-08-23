import { cn } from '../../lib/cn';
import type { IconSize } from '../icon/icon';
import { SpinnerIcon } from '../icon/icon-catalog';

export interface SpinnerProps {
  size?: IconSize;
  /**
   * What is being waited for. Announced; not drawn. Name the operation when
   * there is one -- "Loading events" beats the default.
   */
  label?: string;
  className?: string;
}

/**
 * Work in progress.
 *
 * It carries `role="status"` and a label, so a screen reader is told something
 * is happening. Without that a spinner is a decoration that only sighted users
 * benefit from, and the wait is exactly the moment when everyone needs to know.
 * The icon inside is decorative, so the label is the whole announcement and it
 * defaults rather than being optional.
 *
 * With reduced motion it stops spinning: the icon stays, and what says "still
 * working" is that it is still there.
 */
export function Spinner({
  size = 'lg',
  label = 'Loading',
  className,
}: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex')}>
      <SpinnerIcon
        size={size}
        className={cn('animate-spin motion-reduce:animate-none', className)}
      />
    </span>
  );
}

Spinner.displayName = 'Spinner';
