import { cn } from '../../lib/cn';

/**
 * The bare table elements, styled from the token scale.
 *
 * These replace what a component kit would hand you. They are deliberately
 * thin: every decision about width, density and layout is made in
 * `data-table.tsx` and `sizing.ts`, and a primitive that also had opinions
 * about those would be a second place to look when a column comes out wrong.
 *
 * No scroll wrapper. `DataTable` owns the scroll box, because that is the
 * element a sticky header has to be sticky inside; a wrapper here would nest a
 * second one and quietly detach the two.
 */

export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <table
      className={cn('w-full border-collapse text-body', className)}
      {...props}
    />
  );
}

export function TableHeader({
  className,
  ...props
}: React.ComponentProps<'thead'>) {
  return <thead className={cn('[&_tr]:border-b', className)} {...props} />;
}

export function TableBody({
  className,
  ...props
}: React.ComponentProps<'tbody'>) {
  return (
    <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
  );
}

export function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'border-b border-border',
        'transition-colors duration-instant ease-standard',
        'hover:bg-surface-hover',
        // Selection is read from the attribute the shell sets, not from a prop
        // threaded down, so the row cannot look selected while the table thinks
        // otherwise.
        'data-[state=selected]:bg-surface-selected',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'px-3 text-left align-middle',
        'font-mono text-column uppercase text-fg-muted',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('px-3 align-middle', className)} {...props} />;
}
