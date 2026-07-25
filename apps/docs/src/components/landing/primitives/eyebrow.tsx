import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The small mono label that opens a section. Sections are numbered so the page
 * reads as a sequence rather than a stack of unrelated blocks.
 */
export function Eyebrow({
  index,
  children,
  className,
}: {
  index?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn('eyebrow flex items-center gap-3', className)}>
      {index ? (
        <span className="text-primary tabular-nums">{index}</span>
      ) : null}
      <span>{children}</span>
    </p>
  );
}
