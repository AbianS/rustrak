import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The ruled frame every section lives inside.
 *
 * Two vertical hairlines run unbroken from the nav to the footer and each band
 * closes against them with a horizontal rule. That single continuous frame is
 * what makes a page of loosely related sections read as one drawn document
 * rather than as a stack of blocks, and it is the device this layout is built
 * around: without it the generous white space just looks like padding.
 */
export function GridFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6">
      {/*
        `clip`, not `hidden`. The two are identical in what they trim, and
        opposite in what they cost: `hidden` would make this box a scroll
        container, which would take the sticky chapter rail inside it and stick
        it to *this* element instead of to the viewport. `clip` trims without
        becoming one, so the rail is untouched.

        It is a backstop, not the fix — everything inside is meant to fit, and
        the tracks below are sized so that it does. What it guarantees is that
        a single mis-sized cell can never again turn into the whole document
        sliding sideways, which is a failure that hides the right-hand rule of
        the frame and makes every section look broken at once.
      */}
      <div className="overflow-x-clip border-x border-rule">{children}</div>
    </div>
  );
}

/** One horizontal band of the frame. */
export function Band({
  children,
  className,
  ruled = true,
}: {
  children: ReactNode;
  className?: string;
  /** The last band on the page closes against the footer instead. */
  ruled?: boolean;
}) {
  return (
    <section className={cn(ruled && 'border-b border-rule', className)}>
      {children}
    </section>
  );
}

/**
 * A padded cell. Cells are the only thing that carries inner spacing, so the
 * rules always meet at the edges instead of floating inside a margin.
 */
export function Cell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-5 py-12 sm:px-10 sm:py-20', className)}>
      {children}
    </div>
  );
}
