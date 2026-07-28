import Link from 'next/link';
import { GithubIcon } from '@/components/icons/github';
import { AsciiField } from '../ascii-field/ascii-field';
import { GITHUB } from '../links';
import { Deferred } from '../primitives/deferred';
import { Band } from '../primitives/grid';
import { Heading } from '../primitives/heading';

/**
 * The last word, over the third and final painting.
 *
 * A third painting is safe here because seven bands sit between the manifesto
 * and this one, so by the time the ASCII returns the reader has stopped
 * expecting it. It also closes a bracket: the page opens on a painting and ends
 * on one, with the ruled frame in between as the argument.
 *
 * David's The Death of Socrates — conviction rather than enthusiasm, and it
 * keeps the Greek thread the manifesto opened with the School of Athens. The
 * choice is also about the medium: neoclassicism gives hard contours, separated
 * figures and a dark vault behind lit bodies, where Bruegel's Hunters in the
 * Snow (which held this slot first) rendered as an even mid-tone across most of
 * the band, and an even mid-tone is the one thing this ramp cannot resolve into
 * a shape.
 *
 * `intensity` is 1.3 rather than the 1 the other bands use, by measurement: a
 * prison interior comes out at roughly 55% of the hero's luminance at the same
 * setting. 1.4 was tried and pushed the heading's muted half to 4.35:1, under
 * AA.
 *
 * This band is an ordinary background inside an ordinary band, and has to be,
 * because it is the lid for the footer pinned below it (see `sections/footer`
 * and `primitives/pinned`). Pinning this one instead does not work: a pinned
 * band needs the neighbour above it to be opaque, and that neighbour is
 * `Sponsors`, which renders nothing when there is nobody to thank. A lid only
 * needs to exist, and this one always does.
 */
export function Closing() {
  return (
    <Band>
      {/*
        A floor rather than height from the contents, which filled the band
        almost exactly and left the painting a letterbox to be cropped into.

        78svh is the painting's number: the canvas covers its box, so the band's
        aspect decides how much of the picture's width survives. At 78svh the
        frame is about 2:1 and the crop takes a few percent off each side; at
        100svh it is 1.56:1 and takes a sixth off each edge, which is Plato on
        one side and half the mourners on the other. Lower on a phone, where a
        taller band is a *narrower* window on a wide painting.
      */}
      <div className="relative flex min-h-104 items-center overflow-hidden sm:min-h-[78svh]">
        {/*
          Mounted only as the band comes within reach, like every other
          recreated surface: it is a grid of cells and a three second reveal,
          and spending them early would mean the one painting nobody ever sees
          resolve.

          The source is 290 columns where the other two are 470 and 401, which
          is the opposite of the obvious move and the reason this band reads.
          `AsciiField` draws at a fixed 8px cell and lets CSS size the canvas,
          so the grid decides the bitmap and the band decides the scale: at 470
          columns the bitmap is ~2350px against a frame of at most 1408, so
          every glyph paints at about five and a half pixels and the picture
          stops being ASCII and becomes a grey texture made of letters. 290 puts
          it at roughly 1:1 in this band, and at a quarter of the weight.
        */}
        <Deferred className="absolute inset-0" rootMargin="900px">
          <AsciiField
            source="/death-of-socrates.txt"
            className="inset-y-0"
            intensity={1.3}
          />
        </Deferred>

        {/*
          Pools darkness under the type only, rather than dimming the whole
          picture so a sentence survives.

          The outer stop is the whole design. At the manifesto's 0.40 the
          gradient does not fall off to nothing at the band's edge — it holds a
          40% wash over every pixel and puts a darker patch in the middle, which
          measured left about a fifth of the painting's luminance standing.
          Reaching effectively zero at the edge and pulling the extents *in*
          gives contrast where the words are and nothing where they are not.

          54% × 48% is the loosest pool that still holds the heading's muted
          half above 4.5:1 at `intensity` 1.3, tuned against that number rather
          than by eye: every 2% given back to the pool is picture taken away.
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
              /* Matched to the hero's pair, and for the hero's own reason: this
                 band has a painting behind it too, and a hairline has no chance
                 over an ASCII field. See the note in `sections/hero.tsx`. */
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
