import Link from 'next/link';
import { GithubIcon } from '@/components/icons/github';
import { AsciiField } from '../ascii-field';
import { GITHUB } from '../links';
import { Deferred } from '../primitives/deferred';
import { Band } from '../primitives/grid';
import { Heading } from '../primitives/heading';

/**
 * The last word, over the third and final painting.
 *
 * ── Why this band gets one ──────────────────────────────────────────────────
 *
 * Two bands carried a painting and they were deliberately spread, on the rule
 * that two in a row stops being a gesture and becomes wallpaper. A third is
 * safe here for the same reason: seven bands of product, migration, engine and
 * install sit between the manifesto and this one, so by the time the ASCII
 * returns the reader has long since stopped expecting it.
 *
 * It also closes a bracket. The page opens on a painting and ends on one, and
 * the ruled frame in between is the argument — which is the read a third
 * picture dropped in the middle would have destroyed and one placed last
 * creates.
 *
 * ── The painting ────────────────────────────────────────────────────────────
 *
 * David's The Death of Socrates: condemned, offered the cup, and still teaching
 * — one hand reaching for the hemlock and the other pointing up, because he
 * will not take the deal that would have let him live. It is the register the
 * closing band asks for, which is conviction rather than enthusiasm, and it
 * keeps the Greek thread the manifesto opened with the School of Athens.
 *
 * Bruegel's Hunters in the Snow held this slot first and was replaced for a
 * reason worth keeping, because it is about the medium rather than the subject.
 * A snow painting inverts the tonal habit of the other two: they are dark rooms
 * with lit figures, it is a bright field with dark marks in it. Rendered at 290
 * columns that field is an even mid-tone across most of the band, and an even
 * mid-tone is the one thing this ramp cannot make legible — there is nothing
 * for the eye to resolve into a shape. David's neoclassicism is the opposite
 * case and close to ideal here: hard contours, separated figures, a dark vault
 * behind a few brightly lit bodies.
 *
 * `intensity` is 1.3 rather than the 1 the other two bands use, and that is
 * measurement rather than taste. This is a prison interior and it comes out at
 * roughly 55% of the hero's luminance at the same setting, so left at 1 it read
 * as a smudge in the dark instead of a picture. 1.3 puts it within reach of the
 * hero; 1.4 was tried and pushed the heading's muted half to 4.35:1, under AA.
 *
 * ── This band is held still; it does the holding ────────────────────────────
 *
 * The manifesto holds its painting and lets the page slide off it. This one is
 * an ordinary background inside an ordinary band, and it has to be, because it
 * is the lid for the band below: the footer is what is pinned at the end of the
 * page, and this is the opaque block that slides up to uncover it (see
 * `sections/footer.tsx`, and `primitives/pinned.tsx` for the mechanism).
 *
 * Pinning this one instead was considered and does not work, for a reason worth
 * recording. A pinned band is pulled up a full screen behind whatever precedes
 * it and needs that neighbour to be opaque; the neighbour here is `Sponsors`,
 * which renders nothing at all when there is nobody to thank. On a fork with no
 * sponsors the closing would slide up behind `OneCommand` instead and the
 * effect would come apart. A held band that depends on the sponsor count is not
 * a held band — whereas a *lid* has no such requirement, since it only needs to
 * exist, and this one always does.
 */
export function Closing() {
  return (
    <Band>
      {/*
        The band is given a floor rather than left to be as tall as its
        contents. At `py-32` the copy filled it almost exactly, which left the
        painting a letterbox to be cropped into and nothing to be a picture in.

        78svh rather than a full screen, and that is the painting's number: the
        canvas covers its box, so the band's aspect decides how much of the
        picture's width survives. At 78svh the frame is about 2:1 and the crop
        is a few percent off each side; at 100svh it is 1.56:1 and takes a sixth
        of the width off each edge, which is Plato on one side and half the
        mourners on the other.

        It is also, separately, the lid over the footer below — but that costs
        nothing here. A bottom-stuck footer can never be pulled above the top of
        the box it shares with this band, so the lid cannot be too short to do
        its job; the worst a short window does is finish the reveal early. See
        `sections/footer.tsx`.

        The floor is lower on a phone, where a taller band would be a
        *narrower* window on a wide painting: a full screen at 390px cuts this
        one down to a vertical slice of a single figure.
      */}
      <div className="relative flex min-h-104 items-center overflow-hidden sm:min-h-[78svh]">
        {/*
          Mounted only as the band comes within reach, like every other
          recreated surface on the page: it is a grid of cells and a three
          second reveal, and spending them before anyone has scrolled here
          would mean the one painting nobody ever sees resolve.
        */}
        {/*
          ── 290 columns, not 470 ──────────────────────────────────────────

          The other two paintings are 470 and 401 columns wide and this one is
          deliberately coarser, which is the opposite of the obvious move and
          the reason this band reads at all.

          `AsciiField` draws at a fixed 8px cell and then lets CSS size the
          canvas, so the grid decides the bitmap and the band decides the
          scale. At 470 columns the bitmap comes out about 2350px wide against
          a frame that is at most 1408, so the browser paints the whole thing
          at 69% and every glyph lands at about five and a half pixels. That
          is under the size at which a character is a character, so the
          picture stops being ASCII and becomes a grey texture that happens to
          have been made of letters.

          290 columns puts the bitmap at roughly 1450 × 710, which is 1:1 in
          this band. The glyphs are drawn at the size they were measured for
          and the individual characters are visible, which is the whole effect
          — the picture is supposed to be legibly made of type.

          It is also a quarter of the weight: 25,000 cells against the hero's
          58,000, so the file is 25KB rather than 65KB and the reveal repaints
          a quarter as much per frame.

          The 1:1 is the desktop band's, and a phone does not get it — at
          390px the canvas is covered at about 0.59 and the glyphs are back
          down to five pixels. That is not solvable from here: the cell size
          is a constant inside `AsciiField`, so matching it per band would
          mean the component measuring its own box and choosing a grid, which
          is a change to all three paintings rather than to this one. What a
          phone gets is the same thing the other two bands give it, which is
          the picture as texture.
        */}
        <Deferred className="absolute inset-0" rootMargin="900px">
          <AsciiField
            source="/death-of-socrates.txt"
            className="inset-y-0"
            intensity={1.3}
          />
        </Deferred>

        {/*
          Pools darkness under the type only, exactly as the manifesto's does
          — and for the same stated reason: the alternative is dimming the
          whole picture so a sentence survives, which spends the painting to
          protect the text instead of arranging them.

          ── The outer stop is the whole design ────────────────────────────

          It is the manifesto's gradient with the last number changed from
          0.40 to 0.02, and that one number is the difference between a pool
          and a veil. An outer stop of 0.40 does not fall off to nothing at
          the edge of the band; it holds a 40% wash over every pixel of the
          picture and puts a darker patch in the middle of it. The first
          attempt here kept that value and widened the extents to 68% × 66%
          on the reasoning that this band carries more type than the
          manifesto's does. Measured, it left about a fifth of the painting's
          luminance standing, which is how a picture ends up looking like a
          shape in the dark.

          Reaching effectively zero at the edge and pulling the extents *in*
          rather than out does both jobs at once. Contrast where the words
          are, nothing where they are not: the heading's muted half measures
          4.9:1 against the brightest ground it can land on, which clears AA,
          and the corners of the painting are untouched.

          The extents were then tuned against the same two numbers rather
          than by eye — 54% × 48% is the loosest pool that still holds the
          text above 4.5:1 at `intensity` 1.3, and every 2% given back to the
          pool is picture taken away from the band.
        */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background:radial-gradient(54%_48%_at_50%_52%,rgba(8,8,8,0.96),rgba(8,8,8,0.76)_55%,rgba(8,8,8,0.02)_100%)]"
        />

        <div className="relative w-full px-5 py-20 text-center sm:px-10 sm:py-32">
          <Heading
            className="display-lg mx-auto max-w-[20ch]"
            lead="Yours end to end."
            rest="The server, the dashboard and the data. GPL-3.0, deployed wherever you say."
            scrub
          />

          {/* Stacked and full width on a phone, as in the hero — the same two
              actions, so they get the same shape. */}
          <div className="mx-auto mt-9 flex max-w-xs flex-col items-stretch gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
            <Link
              href="/getting-started/quickstart"
              className="rounded-lg bg-primary px-4 py-3 text-center text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:py-2.5 sm:text-[14px]"
            >
              Get started
            </Link>
            <a
              href={GITHUB}
              /* Matched to the hero's pair rather than left as a bare
                   outline, and now for the hero's own reason rather than only
                   for consistency: this band has a painting behind it too. A
                   hairline with nothing behind it has no chance over an ASCII
                   field, which is texture at exactly the frequency a 1px edge
                   lives at. The faint fill gives the label a consistent ground
                   instead of whatever glyphs happen to be under it. */
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/18 bg-white/6 px-4 py-3 text-[15px] font-medium text-white/90 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white sm:py-2.5 sm:text-[14px]"
            >
              <GithubIcon className="size-4" />
              Star on GitHub
            </a>
          </div>
        </div>
      </div>
    </Band>
  );
}
