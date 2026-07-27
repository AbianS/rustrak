'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { AppFrame } from '../app-mock/app-frame';
import { Deferred } from '../primitives/deferred';
import { Band } from '../primitives/grid';
import { Heading, Pill } from '../primitives/heading';

/**
 * Split out of the initial bundle for the same reason the platform screens are:
 * it is a few hundred nodes of recreated UI that nobody has scrolled to yet.
 * `ssr: false` keeps it out of the exported HTML as well as the first chunk,
 * which is safe because the screen is `aria-hidden` decoration — the claim this
 * section makes is in its heading, and that is server-rendered.
 */
const MockReleases = dynamic(
  () => import('../app-mock/mock-releases').then((mod) => mod.MockReleases),
  { ssr: false },
);

/**
 * The centred claim with a screen running off the bottom of the band.
 *
 * ── Why the screen is cut off ───────────────────────────────────────────────
 *
 * Because it is not a screenshot, it is a window. A panel that fits neatly
 * inside its section reads as a picture of the product that somebody placed
 * there; one that leaves through the bottom edge reads as the product
 * continuing past what there is room to show. The crop is the difference
 * between "here is an image of a table" and "here is a table, and there is more
 * of it".
 *
 * It also does something specific for this page. The band below is the pinned
 * painting, and a pinned band is uncovered by whatever sits on top of it
 * sliding away. A section that ends on a hard horizontal rule announces the
 * seam; one that ends mid-table has no seam to announce, so the painting is
 * revealed out from behind a screen that appears to carry on underneath it.
 *
 * ── Why it goes here ────────────────────────────────────────────────────────
 *
 * The page ran from "these SDKs reach it" straight to "you already did the hard
 * part", which skipped the obvious question in between: fine, but what do I
 * actually have to do? This answers it before the claim is made, so the claim
 * lands as a summary rather than as an assertion.
 *
 * It is also, mechanically, the lid. The SDK strip alone was a couple of
 * hundred pixels of content covering a full screen of painting, so the reveal
 * had almost nothing to slide off. This gives it a body.
 */
export function DayOne() {
  return (
    <Band ruled={false} className="overflow-hidden">
      <div className="px-5 pt-14 pb-0 text-center sm:px-10 sm:pt-16">
        <Pill>Day one</Pill>
        {/* Kept to two short sentences on purpose. This band is the lid over a
            pinned painting, so its height is structural rather than free: every
            extra line here is a line the reader scrolls before the reveal can
            start, and the claim does not need them.

            The lead used to be "There is nothing to set up.", which the very
            next sentence then contradicted by listing three things to do.
            Counting them instead keeps the promise small enough to be true, and
            three is a small number anyway. */}
        <Heading
          className="display-lg mx-auto mt-5 max-w-[20ch]"
          lead="Set up in three steps."
          rest="Create a project, copy the DSN, deploy. Releases, sessions and issues start filling in on their own."
          scrub
        />

        <div className="mt-7 flex justify-center">
          <Link
            href="/getting-started/quickstart"
            className="rounded-lg bg-primary px-4 py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </div>

      {/*
        The crop.

        `max-h` plus `overflow-hidden` on the wrapper rather than a shorter
        `AppFrame`: the frame keeps its real aspect ratio and the app inside it
        stays at the app's own measurements, and the band simply shows less of
        it. Shrinking the frame instead would squash the recreated UI, which is
        exactly the dishonesty the whole app-mock exists to avoid.

        The fade at the bottom edge stops the crop reading as a rendering
        failure. A hard cut across a table looks like something went wrong;
        a cut that dissolves reads as depth.
      */}
      <div className="relative mt-10 max-h-[19rem] overflow-hidden px-3 sm:mt-12 sm:max-h-[24rem] sm:px-10">
        <div className="mx-auto w-full max-w-[1000px]">
          <AppFrame>
            <Deferred className="h-full w-full">
              <MockReleases />
            </Deferred>
          </AppFrame>
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background"
        />
      </div>
    </Band>
  );
}
