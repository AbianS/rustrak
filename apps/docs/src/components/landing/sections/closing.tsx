import Link from 'next/link';
import { GithubIcon } from '@/components/icons/github';
import { GITHUB } from '../links';
import { Field } from '../primitives/field';
import { Band } from '../primitives/grid';
import { Heading } from '../primitives/heading';

/**
 * The last word.
 *
 * It used to sit over an ASCII rendering of David's The Death of Socrates, closing a
 * bracket the hero opened with another painting. The paintings are gone, and what
 * replaced them here is height: the band keeps its 78svh floor, so the closing
 * sentence has most of a screen of nothing around it. That was always the reason the
 * band was that tall — the painting needed an aspect close to 2:1 to survive its own
 * crop — and it turns out to be the right height for one sentence too.
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
      {/* A floor rather than height from the contents. The contents filled the
          band almost exactly, and a closing sentence that exactly fills its box
          reads as the page running out rather than as the page ending. */}
      <div className="relative flex min-h-104 items-center overflow-hidden sm:min-h-[78svh]">
        {/* The third and last field on the page, and it is safe here for the same
            reason the third painting was: eleven bands sit between this and the
            manifesto, so by the time the surface returns the reader has stopped
            expecting it. It also closes a bracket — the page opens on the field and
            ends on it, with the ruled frame in between as the argument. */}
        <Field />
        {/* Lighter than the pool the painting needed. A field has no detail at the
            frequency type lives at, so what has to be held back is the lit corner
            and nothing else. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background:radial-gradient(58%_52%_at_50%_52%,rgba(6,6,6,0.92),rgba(6,6,6,0.68)_58%,rgba(6,6,6,0.14)_100%)]"
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
              /* Matched to the hero's pair, and for the hero's own reason: the
                 painting this sat over is gone, and a field has no detail at
                 the frequency a 1px edge lives at — so the border holds on its
                 own and the fill it needed is the louder of the two options for
                 no remaining reason. See the note in `sections/hero.tsx`. */
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-[15px] font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white sm:py-2.5 sm:text-[14px]"
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
