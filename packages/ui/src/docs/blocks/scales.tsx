import type { ReactNode } from 'react';
import { Text } from '../../components/text/text';
import { cn } from '../../lib/cn';

/**
 * The figures the Foundations pages are drawn with.
 *
 * Every one of them takes the utility class as a prop rather than building it
 * from the token name. Tailwind extracts statically, so `bg-${name}` is a rule
 * that is silently never generated -- the call sites spell the class out, and
 * what looks like repetition is the only version of this that works.
 *
 * The shapes are the brandbook's: a ramp is a contiguous strip with the name
 * inside the swatch, because a colour separated from its label by a gap is a
 * colour somebody will mislabel in review.
 */

/** A ramp: swatches shoulder to shoulder, read left to right. */
export function Ramp({
  children,
  columns = 4,
}: {
  children: ReactNode;
  columns?: 3 | 4 | 5 | 6;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-0.5 overflow-hidden rounded-md',
        columns === 3 && 'sm:grid-cols-3',
        columns === 4 && 'sm:grid-cols-4',
        columns === 5 && 'sm:grid-cols-5',
        columns === 6 && 'sm:grid-cols-3 lg:grid-cols-6',
      )}
    >
      {children}
    </div>
  );
}

/**
 * One colour, with its token name inside it.
 *
 * `on` is the text colour, and it is the caller's job: the swatch is the
 * colour being documented, so nothing here can know whether the name written
 * on it needs to be dark or light.
 */
export function Swatch({
  token,
  className,
  on = 'text-fg',
  note,
}: {
  token: string;
  className: string;
  on?: string;
  note?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex min-h-24 flex-col justify-end gap-0.5 p-3 ring-1 ring-border-divider ring-inset',
        className,
      )}
    >
      <Text variant="mono-sm" tone="inherit" className={cn('truncate', on)}>
        {token}
      </Text>
      {note ? (
        <Text
          variant="badge"
          tone="inherit"
          className={cn('truncate opacity-70', on)}
        >
          {note}
        </Text>
      ) : null}
    </div>
  );
}

/**
 * One step of the type scale, set in the face it actually uses.
 *
 * The sample is real product text rather than lorem ipsum: what this scale has
 * to survive is an exception message and a stack frame, not Latin.
 */
export function TypeRow({
  token,
  className,
  role,
  sample,
}: {
  token: string;
  className: string;
  role: string;
  sample: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-border-divider border-b py-4 sm:flex-row sm:items-baseline sm:gap-8">
      <div className="flex w-44 shrink-0 flex-col gap-0.5">
        <Text variant="mono-sm">{token}</Text>
        <Text variant="badge" tone="ghost">
          {role}
        </Text>
      </div>
      <p className={cn('min-w-0 truncate text-fg', className)}>{sample}</p>
    </div>
  );
}

/** A measured bar: the token's own size, drawn, with the name beside it. */
export function ScaleRow({
  token,
  className,
  note,
}: {
  token: string;
  className: string;
  note?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 border-border-divider border-b py-3">
      <Text variant="mono-sm" tone="secondary" className="w-44 shrink-0">
        {token}
      </Text>
      <div className={cn('rounded-2xs bg-surface-brand', className)} />
      {note ? (
        <Text variant="badge" tone="ghost">
          {note}
        </Text>
      ) : null}
    </div>
  );
}

/** A specimen box carrying a radius or a shadow, to be compared with its row. */
export function Chip({
  token,
  className,
  label,
}: {
  token: string;
  className: string;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          'flex size-20 items-center justify-center bg-surface-raised',
          className,
        )}
      >
        {label ? (
          <Text variant="badge" tone="ghost">
            {label}
          </Text>
        ) : null}
      </div>
      <Text variant="mono-sm" tone="meta">
        {token}
      </Text>
    </div>
  );
}
