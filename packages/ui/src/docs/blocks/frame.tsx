import type { ReactNode } from 'react';
import { Text } from '../../components/text/text';
import { cn } from '../../lib/cn';

/**
 * The stage a live example stands on.
 *
 * A specimen needs a floor: without one the components float on the page and
 * a `ghost` button, which is transparent until pointed at, is documentation of
 * nothing. The dot grid is the one place in this package where geometry is
 * written by hand -- it is drawing paper, not a component, and only the
 * spacing of the dots is a number. The colour is the published token.
 */
const DOT_GRID = {
  backgroundImage:
    'radial-gradient(var(--color-border-divider) 1px, transparent 1px)',
  backgroundSize: '8px 8px',
} as const;

export function Stage({
  children,
  label,
  caption,
  stack,
  className,
}: {
  children: ReactNode;
  /** A short mono label pinned to the top-left corner of the frame. */
  label?: string;
  /** One line under the frame. The specimen says what it is; this says why. */
  caption?: ReactNode;
  /** Lays the children out in a column instead of a row. */
  stack?: boolean;
  className?: string;
}) {
  return (
    <figure className="flex flex-col gap-3">
      <div
        className={cn(
          'relative overflow-hidden rounded-md border border-border-subtle bg-canvas px-8 py-10',
          className,
        )}
        style={DOT_GRID}
      >
        {label ? (
          <Text variant="badge" tone="ghost" className="absolute top-3 left-4">
            {label}
          </Text>
        ) : null}
        <div
          className={cn(
            'relative flex flex-wrap items-center justify-center gap-5',
            stack && 'flex-col items-start gap-2',
          )}
        >
          {children}
        </div>
      </div>
      {caption ? (
        <Text
          variant="meta"
          tone="meta"
          render={<figcaption />}
          className="max-w-prose"
        >
          {caption}
        </Text>
      ) : null}
    </figure>
  );
}

/** A gallery of specimens, each one named. */
export function Cards({
  children,
  columns = 3,
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        columns === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
      )}
    >
      {children}
    </div>
  );
}

/**
 * One specimen: the name first, the thing itself under it.
 *
 * The name goes on top because the reader is scanning for a component, not
 * admiring a grid -- and a caption underneath an unfamiliar shape makes them
 * look twice at everything.
 */
export function Card({
  title,
  children,
  note,
}: {
  title: string;
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-border-subtle bg-panel">
      <div className="flex min-h-16 flex-col gap-0.5 px-4 pt-4 pb-3">
        <Text variant="control" className="font-semibold">
          {title}
        </Text>
        {note ? (
          <Text variant="meta" tone="meta">
            {note}
          </Text>
        ) : null}
      </div>
      <div
        className="flex min-h-28 flex-1 flex-wrap items-center justify-center gap-3 border-border-divider border-t bg-canvas p-6"
        style={DOT_GRID}
      >
        {children}
      </div>
    </div>
  );
}
