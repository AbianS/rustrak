import { cn } from '../../lib/cn';
import { tv, type VariantProps } from '../../lib/tv';

/**
 * A proportion, as a thin bar: crash-free sessions, quota used, adoption of a
 * release.
 *
 * Not a progress bar. Nothing here is loading, so there is no indeterminate
 * state and no animation: the value is a fact about the data, and a bar that
 * slides on every re-render turns a dashboard into a slot machine.
 *
 * It is a `meter` in the ARIA sense rather than a `progressbar`, and the
 * distinction is the one the spec draws: `progressbar` is a task advancing
 * towards completion, `meter` is a measurement within a known range. Quota used
 * is a measurement.
 */
const meter = tv({
  slots: {
    track: 'h-meter w-full overflow-hidden rounded-xs bg-surface-selected',
    // Width is the only thing that moves, and it is set inline from the value.
    // A transition would animate it on every poll of live data.
    fill: 'h-full rounded-xs',
  },
  variants: {
    tone: {
      brand: { fill: 'bg-surface-brand' },
      success: { fill: 'bg-fg-success' },
      warning: { fill: 'bg-fg-warning' },
      error: { fill: 'bg-fg-error' },
      neutral: { fill: 'bg-fg-subtle' },
    },
  },
  defaultVariants: { tone: 'brand' },
});

export type MeterTone = NonNullable<VariantProps<typeof meter>['tone']>;

export interface MeterProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>,
    VariantProps<typeof meter> {
  /** Where the value sits between `min` and `max`. */
  value: number;
  /** @default 0 */
  min?: number;
  /** @default 100 */
  max?: number;
  /**
   * What a screen reader announces. Required: a bare number is meaningless out
   * of context, and "78" tells nobody whether that is good or bad.
   */
  label: string;
  /**
   * The spoken form of the value, when the number alone would mislead.
   * e.g. `"99.4% crash free"` rather than `"99.4"`.
   */
  valueText?: string;
}

export function Meter({
  value,
  min = 0,
  max = 100,
  label,
  valueText,
  tone,
  className,
  ...props
}: MeterProps) {
  const { track, fill } = meter({ tone });

  // Clamped rather than trusted, and clamped once so the bar and the
  // announcement can never disagree. These values come from an API, and a
  // division by a zero denominator upstream arrives here as NaN or Infinity.
  //
  // Clamping only the width is not enough, and that was the first version of
  // this: `aria-valuenow="NaN"` is invalid ARIA, so the bar looked right and
  // the screen reader got garbage. Everything derives from `safeValue` now.
  const span = max - min;
  const safeValue = Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : min;
  const percent = span > 0 ? ((safeValue - min) / span) * 100 : 0;

  return (
    // The native <meter> element cannot be styled to this design: its bar and
    // fill are engine-specific pseudo-elements (`::-webkit-meter-bar`,
    // `::-moz-meter-bar`) with no agreed way to set a radius or a token colour.
    // A div carrying the role is what every design system ends up with, and the
    // ARIA contract is identical.
    // biome-ignore lint/a11y/useSemanticElements: see above
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={safeValue}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={valueText}
      className={cn(track(), className)}
      {...props}
    >
      <div className={fill()} style={{ width: `${percent}%` }} />
    </div>
  );
}

Meter.displayName = 'Meter';
