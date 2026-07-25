import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * How much of the held band is hidden behind its neighbours at each end.
 *
 * Exported because it takes three elements to make the effect work — the block
 * above, the held band, and the block below — and all three have to agree on
 * one number or the seam shows as a gap or a jump.
 */
/**
 * How far the band is pulled up behind the section above it.
 *
 * Exactly one screen, and it has to be exactly one screen. Anything less and
 * the band is visible before it is stuck: a `sticky` element only stops when
 * its top reaches the top of the viewport, so with an overlap of, say, 62svh
 * there is a 38svh stretch where the band has been uncovered at the bottom of
 * the screen but is still scrolling up like an ordinary section. It reads as a
 * lurch — the thing slides, then abruptly freezes — and it is the single most
 * obvious way this effect gives itself away.
 *
 * At a full screen the two moments coincide. The first pixel of the band to
 * appear is already pinned, so it never moves at all.
 */
export const PINNED_OVERLAP = '100svh';

/**
 * Extra distance the band is held after it is fully exposed.
 *
 * Zero, deliberately.
 *
 * This started at 45svh on the theory that the band needed a beat to be seen
 * whole. It does not, and the reasoning was double-counting: the reveal is
 * already a full screen of scrolling during which the band is stationary and
 * progressively more of it is visible, so by the time the last of it appears
 * the reader has been looking at it for a screen's worth of travel. Adding a
 * hold on top of that does not extend the moment, it stalls the page — the
 * scroll stops doing anything at exactly the point the reader has finished
 * reading and wants to move on.
 *
 * Kept as a named constant rather than deleted because the knob is the useful
 * artefact: if a band ever genuinely needs dwell time, this is where it goes,
 * and the note above is why it should be a considered decision rather than a
 * default.
 */
export const PINNED_HOLD = '0svh';

/**
 * A band that never moves. The page slides off it, and later back over it.
 *
 * ── What the reader sees ────────────────────────────────────────────────────
 *
 * The band is already in place, sitting behind the section above it. As that
 * section scrolls up and away, the band is *uncovered* — revealed from its top
 * edge downward, like a card being slid off another card. It never travels. It
 * is exposed, held for a moment, and then the next section slides back over it
 * from below and buries it again.
 *
 * That direction matters, and it was wrong the first time. Having the incoming
 * section climb over a held one looks superficially similar and reads
 * completely differently: the eye tracks the moving edge, so with the section
 * *arriving* on top the movement belongs to the new content, and the held band
 * is just something in the way. Uncovering it puts the movement on the thing
 * that is leaving, and the band underneath reads as having been there the whole
 * time — which is the feeling worth having, because the painting behind it is
 * meant to be the floor the page is built on rather than another slide.
 *
 * ── How it works ────────────────────────────────────────────────────────────
 *
 * Three plain CSS facts, no scroll listener and no measurement.
 *
 * The wrapper is pulled up by `PINNED_OVERLAP` with a negative margin, so the
 * band starts life underneath the tail of whatever precedes it. The band itself
 * is `sticky` at the top of the viewport, so once exposed it stays where it is
 * while the scroll continues. And every neighbour is opaque and on a higher
 * layer, which is what does the covering: without a background on the sections
 * around it the painting shows straight through them and the effect collapses
 * into a z-index bug.
 *
 * The cost is one composited layer for the height of one screen. No frame ever
 * runs JavaScript for it.
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
        /*
          One screen for the band itself, plus the distance it spends being
          uncovered, plus the distance it spends fully exposed. When that runs
          out the sticky simply releases and the band scrolls away like any
          other section — the page carries on normally from there, and nothing
          below it needs to know this happened.
        */
        height: `calc(100svh + ${overlap} + ${hold})`,
        // Slides up behind the section above, which is what leaves it something
        // to be uncovered from.
        marginTop: `calc(-1 * ${overlap})`,
      }}
    >
      {/*
        `svh`, not `vh`. On a phone the browser chrome collapses as you scroll,
        so `vh` is the *large* viewport: a band sized in it is taller than the
        screen at the moment it is meant to be exactly filling it, and the held
        band would sit a chrome's height too low. The effect would read as a
        misaligned section rather than as a deliberate stop.
      */}
      <div className={cn('sticky top-0 z-0 h-svh overflow-hidden', className)}>
        {children}
      </div>
    </div>
  );
}

/**
 * The opaque block that a `Pinned` band is hiding behind.
 *
 * Goes *above* one, and only above. Its job is to be the thing that slides away
 * to uncover the band, and the background is what makes that possible: without
 * one the painting shows straight through it and there is nothing to be
 * uncovered from.
 *
 * ── Nothing goes over the band on the way out ───────────────────────────────
 *
 * The first version of this also pulled the *following* section up so that it
 * climbed back over the held band, on the theory that symmetry would read as
 * deliberate. It read as broken, and the reason is worth writing down: the band
 * was being uncovered from the top and covered from the bottom at the same
 * time, so the sentence inside it was squeezed between two moving edges and was
 * never once visible in full. A held band has to be released, not crushed.
 *
 * So the band is uncovered, held, and then it scrolls away exactly like any
 * other section. Everything after it is ordinary page flow and needs no
 * co-operation at all.
 */
export function Cover({ children }: { children: ReactNode }) {
  return <div className="relative z-10 bg-background">{children}</div>;
}
