import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { tv, type VariantProps } from '../../lib/tv';
import { EmptyIcon } from '../icon/icon-catalog';
import { Text } from '../text/text';

/**
 * A titled box: one figure, one chart, one short list.
 *
 * It is the unit an overview is built out of, and the reason it exists as a
 * component rather than as a `div` with a border is that the header is the part
 * that has to stay identical. Twelve boxes on one screen, each with its own
 * hand-set title, drift within a week: one is 12 px, the next is 13, one is
 * uppercase and one is not, and the page stops reading as a grid.
 *
 * The title is set in the column style -- small, mono, uppercase, meta grey --
 * because a card title is a label for what is inside, not a heading competing
 * with the page's own. It is still marked up as one: the outline is what a
 * screen reader navigates a dense page by, and the type size is a separate
 * question from the structure.
 *
 * It carries no elevation. Depth here comes from the surface being a step above
 * the canvas, which is how the rest of the system reads depth; a shadow under
 * every tile turns a dense grid into a pile of receipts.
 */
const card = tv({
  base: 'flex min-w-0 flex-col rounded-xl border border-border-subtle bg-panel',
  variants: {
    /** Fills the row it is in, for a grid whose cells are not the same height. */
    fill: { true: 'h-full' },
    /** The body scrolls instead of the card growing. */
    contain: { true: 'min-h-0 overflow-hidden' },
  },
});

export interface CardProps extends VariantProps<typeof card> {
  children: ReactNode;
  className?: string;
}

export function Card({ fill, contain, className, children }: CardProps) {
  return (
    <section className={card({ fill, contain, className })}>{children}</section>
  );
}

Card.displayName = 'Card';

export interface CardHeaderProps {
  title: ReactNode;
  /** One line under the title, saying what the figure is measured over. */
  subtitle?: ReactNode;
  /** Pushed to the end: a period control, a link to the full list. */
  actions?: ReactNode;
  className?: string;
}

/**
 * The card's heading row.
 *
 * It wraps, and the actions take the full width once they no longer fit beside
 * the title, for the same reason `PageHeader` does: a tile is 320 px wide on a
 * phone and squeezing a title toward zero to keep a control on the same line
 * costs the one thing that says what you are looking at.
 */
export function CardHeader({
  title,
  subtitle,
  actions,
  className,
}: CardHeaderProps) {
  return (
    <header
      className={cn(
        'flex shrink-0 flex-wrap items-start justify-between gap-x-4 gap-y-2',
        'px-4 pt-3.5 pb-2.5',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {/* A real heading, not a styled span: six of these on one screen are
            the page's outline, and it is the only way through them for anyone
            who does not read by eye. */}
        <Text render={<h2 />} tone="meta" truncate variant="column">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="hint" tone="ghost" className="mt-1 block">
            {subtitle}
          </Text>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

CardHeader.displayName = 'CardHeader';

const cardBody = tv({
  base: 'flex min-h-0 min-w-0 flex-1 flex-col',
  variants: {
    /** No padding: a chart and a table draw to their own edges. */
    flush: { true: '', false: 'px-4 pt-0.5 pb-4' },
    scroll: { true: 'min-h-0 overflow-y-auto' },
  },
  defaultVariants: { flush: false },
});

export interface CardBodyProps extends VariantProps<typeof cardBody> {
  children: ReactNode;
  className?: string;
}

export function CardBody({
  flush,
  scroll,
  className,
  children,
}: CardBodyProps) {
  return (
    <div className={cardBody({ flush, scroll, className })}>{children}</div>
  );
}

CardBody.displayName = 'CardBody';

export interface CardEmptyProps {
  /** What is not there: "No events in this period". */
  children: ReactNode;
  className?: string;
}

/**
 * What a card says when its query came back with nothing.
 *
 * It is a sentence and a mark, centred in whatever room the body has. A chart
 * drawn from an empty series is a flat line on the baseline, and a flat line at
 * zero reads as "nothing is breaking" -- the most dangerous thing an error
 * tracker can say while it is actually saying "I have no data".
 */
export function CardEmpty({ children, className }: CardEmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center',
        className,
      )}
    >
      <EmptyIcon size="xl" className="text-fg-ghost" aria-hidden="true" />
      <Text variant="meta" tone="subtle">
        {children}
      </Text>
    </div>
  );
}

CardEmpty.displayName = 'CardEmpty';
