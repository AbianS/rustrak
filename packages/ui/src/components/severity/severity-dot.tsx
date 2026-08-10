import { cn } from '../../lib/cn';
import { tv, type VariantProps } from '../../lib/tv';

/**
 * The level of an event, as a mark rather than a word.
 *
 * A rounded square, never a circle. In this design the circle means *state*
 * (online, deploying, resolved) and the square means *level*, and the two
 * appear in the same row of a log stream. Making them the same shape would
 * force the reader to check the colour twice.
 *
 * It carries meaning, so it is not `aria-hidden`. Colour alone never conveys
 * anything in this system: the mark ships an accessible name, and the visible
 * label beside it in a row is the redundancy that makes it work for everyone.
 */
const severityDot = tv({
  base: 'inline-block size-dot shrink-0 rounded-xs',
  variants: {
    level: {
      fatal: 'bg-fg-fatal',
      error: 'bg-fg-error',
      warning: 'bg-fg-warning',
      info: 'bg-fg-info',
      debug: 'bg-fg-debug',
    },
  },
  defaultVariants: { level: 'error' },
});

export type SeverityLevel = NonNullable<
  VariantProps<typeof severityDot>['level']
>;

export interface SeverityDotProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>,
    VariantProps<typeof severityDot> {
  /**
   * Overrides the announced name. The default is the level itself, which is
   * what you want in a table cell; pass something fuller when the mark stands
   * alone, e.g. "3 fatal events".
   */
  label?: string;
}

export function SeverityDot({
  level = 'error',
  label,
  className,
  ...props
}: SeverityDotProps) {
  return (
    <span
      role="img"
      aria-label={label ?? level}
      className={cn(severityDot({ level }), className)}
      {...props}
    />
  );
}

SeverityDot.displayName = 'SeverityDot';
