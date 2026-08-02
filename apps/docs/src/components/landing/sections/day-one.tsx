'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Band } from '@/components/frame/grid';
import { AppFrame } from '../app-mock/app-frame';
import { Deferred } from '../primitives/deferred';
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
 * The screen is cut off because it is a window, not a screenshot: a panel that
 * fits neatly inside its section reads as a picture somebody placed there, and
 * one that leaves through the bottom edge reads as the product continuing past
 * what there is room to show. It also matters structurally — the band below is
 * the pinned painting, and a section ending on a hard rule announces the seam
 * where one ending mid-table has no seam to announce.
 *
 * It sits here because the page ran from "these SDKs reach it" straight to the
 * manifesto's claim, skipping the question in between: fine, but what do I
 * actually have to do? Answering first makes the claim land as a summary rather
 * than an assertion. Mechanically it is also the lid — the SDK strip alone was
 * a couple of hundred pixels covering a full screen of painting, so the reveal
 * had almost nothing to slide off.
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
