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
 *
 * This lives under `components/frame` rather than under `components/landing`
 * because it is no longer the landing's. The blog and the changelog were
 * drawing the same frame by hand — `overflow-x-clip border-x border-rule` on a
 * capped box, copied twice — which is how the three pages had already drifted
 * on the two numbers that matter, the cap and whether the top rule is drawn.
 * One component with those two as named props is the whole reason it moved.
 */
export function GridFrame({
  children,
  measure = 'page',
  topRule = false,
  className,
}: {
  children: ReactNode;
  /**
   * `page` is the landing's full composition, where the frame is the layout and
   * the cells inside it carry their own tracks. `reading` caps narrower, for a
   * page whose contents are mostly prose: the frame still has room for a wide
   * masthead and a band of figures, and the column under them stays at a
   * measure without needing a second cap inside every cell.
   */
  measure?: 'page' | 'reading';
  /**
   * Draws the rule across the top of the frame.
   *
   * The landing does not want one: its hero sits above the frame and outside
   * it, so the first thing the frame does is open. A page that starts *at* the
   * frame has nothing above it to close against and needs the edge stated.
   */
  topRule?: boolean;
  /** Outer spacing. The landing takes none; its hero has already provided it. */
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 sm:px-6',
        measure === 'page' ? 'max-w-[1440px]' : 'max-w-[76rem]',
        className,
      )}
    >
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
      <div
        className={cn(
          'overflow-x-clip border-x border-rule',
          topRule && 'border-t',
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** One horizontal band of the frame. */
export function Band({
  children,
  className,
  ruled = true,
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  /** The last band on the page closes against the footer instead. */
  ruled?: boolean;
  /**
   * A band is a `section` unless its contents are already a list of something.
   * The changelog's figures are a `dl` and the tag strip is a `div`: wrapping
   * either in a section to get the rule would put a landmark around four
   * numbers, and a `dl` inside a `section` inside the frame is one box more
   * than the page has meaning for.
   */
  as?: 'section' | 'div' | 'dl';
}) {
  return (
    <Tag className={cn(ruled && 'border-b border-rule', className)}>
      {children}
    </Tag>
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
