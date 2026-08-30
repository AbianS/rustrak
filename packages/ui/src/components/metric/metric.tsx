import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type { ReactNode } from 'react';
import { focusRing } from '../../lib/focus';
import { interactiveTransition } from '../../lib/motion';
import { tv, type VariantProps } from '../../lib/tv';
import { TrendDownIcon, TrendUpIcon } from '../icon/icon-catalog';
import { Text } from '../text/text';
import type { MetricComparison } from './compare';

const metric = tv({
  slots: {
    root: [
      'flex min-w-0 flex-col justify-between gap-2 rounded-xl',
      'border border-border-subtle bg-panel px-4 py-3.5',
    ],
    delta:
      'inline-flex shrink-0 items-center gap-1 font-mono text-mono-sm tabular-nums',
  },
  variants: {
    tone: {
      positive: { delta: 'text-success-fg' },
      negative: { delta: 'text-danger-fg' },
      neutral: { delta: 'text-fg-meta' },
    },
    interactive: {
      true: {
        root: [
          'text-start hover:border-border-strong hover:bg-surface',
          interactiveTransition,
          focusRing,
        ],
      },
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export interface MetricProps
  extends Omit<useRender.ComponentProps<'div'>, 'children'>,
    Pick<VariantProps<typeof metric>, 'interactive'> {
  /** What is being counted. Sentence case, not a heading. */
  label: string;
  /**
   * The figure, formatted. The product owns the locale and the notation --
   * a design system does not get to decide whether 12400 reads as `12,400`
   * or `12.4k`.
   */
  value: ReactNode;
  /** From {@link compareMetric}. Absent, nothing is drawn. */
  comparison?: MetricComparison | null;
  /** What the comparison is against: "vs prev". */
  comparisonLabel?: string;
  /** One line at the foot: "142 open", "no prior period". */
  caption?: ReactNode;
}

/**
 * One figure, with what it was and what that means.
 *
 * The figure is the only loud thing in it. Everything else -- the label above,
 * the change beside it, the line underneath -- is set small and grey, because a
 * row of these is read by scanning the numbers and coming back for the words
 * only where a number looked wrong.
 *
 * The change is never colour alone: it carries an arrow, and the arrow points
 * the way the figure moved while the colour says whether that is good news.
 * They are two different facts and both get drawn -- a red down arrow on
 * crash-free sessions is exactly right, and a system that tied the two together
 * could not say it.
 *
 * With `render` it becomes a link, which is what a figure on an overview
 * usually wants to be: the list it was counted from is the next question.
 */
export function Metric({
  label,
  value,
  comparison,
  comparisonLabel,
  caption,
  interactive,
  className,
  render,
  ...props
}: MetricProps) {
  const styles = metric({
    tone: comparison?.tone,
    interactive: interactive ?? render != null,
  });

  const Arrow =
    comparison && comparison.percent < 0 ? TrendDownIcon : TrendUpIcon;

  return useRender({
    defaultTagName: 'div',
    render,
    props: mergeProps<'div'>(
      {
        className: styles.root({ className }),
        children: (
          <>
            <Text variant="label" tone="muted" truncate>
              {label}
            </Text>

            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <Text variant="numeric-lg" truncate>
                {value}
              </Text>
              {comparison ? (
                <span className={styles.delta()}>
                  {comparison.percent === 0 ? null : (
                    <Arrow size="sm" aria-hidden="true" />
                  )}
                  {comparison.percent > 0 ? '+' : ''}
                  {comparison.percent}%
                  {comparisonLabel ? (
                    <span className="text-fg-meta">{comparisonLabel}</span>
                  ) : null}
                </span>
              ) : null}
            </div>

            {caption ? (
              <Text variant="hint" tone="ghost" truncate>
                {caption}
              </Text>
            ) : null}
          </>
        ),
      },
      props,
    ),
  });
}

Metric.displayName = 'Metric';
