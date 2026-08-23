import { tv, type VariantProps } from '../../lib/tv';

/**
 * The fourteen days of an issue, in a table cell.
 *
 * Hand-drawn SVG, not recharts: a page of fifty rows means fifty of these,
 * and each recharts chart brings its own store, its observers and its
 * animation. A sparkline is a shape to be skimmed, so it gets none of that
 * -- fixed viewBox, no axes, no tooltip, no motion, and the row's own text
 * says the numbers.
 *
 * The tone is state, not decoration: `danger` for the row that is getting
 * worse, `brand` for the one being watched, `neutral` for everything else.
 * A column where every sparkline is coloured says nothing.
 */
const sparkline = tv({
  slots: {
    svg: 'block',
    bar: '',
  },
  variants: {
    tone: {
      neutral: { bar: 'fill-border-control' },
      brand: { bar: 'fill-surface-brand/80' },
      danger: { bar: 'fill-sev-error/75' },
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type SparklineTone = NonNullable<VariantProps<typeof sparkline>['tone']>;

export interface SparklineProps {
  /** One figure per bucket, oldest first. */
  values: number[];
  tone?: SparklineTone;
  width?: number;
  height?: number;
  /**
   * What the shape stands for: "Events, last 14 days". Required -- without
   * it a screen reader meets an unnamed image in every row.
   */
  label: string;
  className?: string;
}

const VIEW_W = 100;
const VIEW_H = 32;

export function Sparkline({
  values,
  tone,
  width = 110,
  height = 28,
  label,
  className,
}: SparklineProps) {
  const styles = sparkline({ tone });
  const max = Math.max(...values, 1);
  const step = VIEW_W / values.length;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className={sparkline().svg({ className })}
    >
      {values.map((value, index) => {
        // Every bucket draws at least a hair of bar: a zero that vanishes
        // reads as a missing bucket, not as a quiet day.
        const h = Math.max((value / max) * (VIEW_H - 2), 1.2);
        return (
          <rect
            // Buckets are positional by nature: index is their identity.
            key={index}
            x={index * step}
            y={VIEW_H - h}
            width={step * 0.62}
            height={h}
            className={styles.bar()}
          />
        );
      })}
    </svg>
  );
}

Sparkline.displayName = 'Sparkline';
