import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * How far the band is pulled up behind the section above it.
 *
 * Exactly one screen, and it has to be. A `sticky` element only stops when its
 * top reaches the top of the viewport, so with a smaller overlap there is a
 * stretch where the band has been uncovered at the bottom of the screen but is
 * still scrolling like an ordinary section — it slides, then abruptly freezes,
 * which is the most obvious way this effect gives itself away. At a full screen
 * the two moments coincide and the first pixel to appear is already pinned.
 */
export const PINNED_OVERLAP = '100svh';

/**
 * Extra distance the band is held after it is fully exposed. Zero, deliberately
 * — the reveal is already a full screen of scrolling with the band stationary,
 * so a hold on top of it does not extend the moment, it stalls the page.
 *
 * Kept as a named knob rather than deleted: if a band ever genuinely needs
 * dwell time this is where it goes, and the note above is why that should be a
 * considered decision rather than a default.
 */
export const PINNED_HOLD = '0svh';

/**
 * A band that never moves. The page slides off it, and later back over it.
 *
 * The band sits behind the section above it and is *uncovered* as that section
 * scrolls away, revealed from its top edge downward like a card being slid off
 * another card. The direction matters and was wrong the first time: with the
 * incoming section climbing over a held one, the eye tracks the moving edge and
 * the movement belongs to the new content, leaving the held band as something
 * in the way. Uncovering puts the movement on the thing that is leaving, so the
 * band reads as having been there the whole time.
 *
 * Three plain CSS facts, no scroll listener and no measurement: the wrapper is
 * pulled up by `PINNED_OVERLAP` with a negative margin, the band is `sticky` at
 * the top of the viewport, and every neighbour is opaque and on a higher layer.
 * That last one does the covering — without a background on the sections around
 * it, the painting shows through and the effect collapses into a z-index bug.
 */
export function Pinned({
  children,
  className,
  overlap = PINNED_OVERLAP,
  hold = PINNED_HOLD,
}: {
  children: ReactNode;
  className?: string;
  overlap?: string;
  hold?: string;
}) {
  return (
    <div
      className="relative"
      style={{
        /* One screen for the band, plus the distance it spends being uncovered
           and fully exposed. When that runs out the sticky releases and the
           band scrolls away like any other section, so nothing below it needs
           to know this happened. */
        height: `calc(100svh + ${overlap} + ${hold})`,
        // Slides up behind the section above, which is what leaves it something
        // to be uncovered from.
        marginTop: `calc(-1 * ${overlap})`,
      }}
    >
      {/* `svh`, not `vh`. On a phone the chrome collapses as you scroll, so
          `vh` is the *large* viewport and a band sized in it is taller than the
          screen at the moment it should be exactly filling it — the held band
          would sit a chrome's height too low and read as misaligned. */}
      <div className={cn('sticky top-0 z-0 h-svh overflow-hidden', className)}>
        {children}
      </div>
    </div>
  );
}

/**
 * The opaque block that a `Pinned` band is hiding behind.
 *
 * Goes *above* one, and only above: its job is to be the thing that slides away
 * to uncover the band, and the background is what makes that possible.
 *
 * Nothing goes back over the band on the way out. Pulling the following section
 * up to climb over it was tried, for symmetry, and read as broken — the band
 * was uncovered from the top and covered from the bottom at once, so the
 * sentence inside was squeezed between two moving edges and never visible in
 * full. Everything after a held band is ordinary page flow.
 */
export function Cover({ children }: { children: ReactNode }) {
  return <div className="relative z-10 bg-background">{children}</div>;
}
