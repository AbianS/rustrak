import { LandingNav } from './nav';
import { GridFrame } from './primitives/grid';
import { Cover } from './primitives/pinned';
import { Alerts } from './sections/alerts';
import { Closing } from './sections/closing';
import { Compatible } from './sections/compatible';
import { DayOne } from './sections/day-one';
import { Engine } from './sections/engine';
import { SiteFooter } from './sections/footer';
import { Hero } from './sections/hero';
import { Manifesto } from './sections/manifesto';
import { Migrate } from './sections/migrate';
import { OneCommand } from './sections/one-command';
import { Platform } from './sections/platform';
import { Scale } from './sections/scale';
import { Sponsors } from './sections/sponsors';
import { SmoothScroll } from './smooth-scroll';

/**
 * The page, as one ruled frame with bands inside it.
 *
 * `landing-root` pins the dark palette independently of the docs theme toggle
 * — see the block in `src/app/globals.css`.
 *
 * There is no opening animation. The page used to sit behind a full-screen
 * intro that also held the scroll still while it played; both are gone, so the
 * page is scrollable from the first frame and everything that enters starts on
 * mount instead (`useStarted`).
 *
 * ── The order is an argument, not a list ────────────────────────────────────
 *
 * It runs: what it is (hero), what already talks to it (compatible), the claim
 * (manifesto), the proof (platform), the cost of acting on it (migrate), how it
 * is built and what that buys (engine, scale), and how to start (one command).
 * Each band answers the question the one above it raises, which is why
 * `Migrate` sits immediately after the product screens: the reader has just
 * decided they want it, and the very next thing they think is "how much work is
 * this".
 *
 * `Engine` and `Scale` are a pair and have to stay adjacent in that order. The
 * first takes the server apart and the second states the bill — `<100MB`,
 * `<50ms`, `10k/s`. Numbers that arrive after their explanation read as a
 * consequence; the same numbers on their own read as marketing.
 *
 * Two bands carry a painting — hero and manifesto — and they are deliberately
 * spread. Two in a row and the ASCII stops being a gesture and becomes
 * wallpaper. There used to be a third on the band `Engine` now occupies: an
 * ASCII Mona Lisa beside four claims about nobody watching your data. The joke
 * was the only thing it did, and it did not move.
 */
export function LandingPage() {
  return (
    <SmoothScroll>
      <div className="landing-root relative min-h-screen antialiased">
        <LandingNav />
        {/* The hero sits outside the ruled frame: it is the one band with no
            vertical rules, so the page opens as open space and the structure
            arrives with the first argument below it. */}
        {/* Opaque and on the upper layer, like every other `Cover`: the pinned
            band below is pulled up behind this one's tail, and without a
            background to hide behind it would paint straight over the hero. */}
        <div className="relative z-10 bg-background">
          <Hero />
        </div>
        <GridFrame>
          <main>
            {/*
              `Compatible` is the lid: it slides up and off to uncover the
              painting held behind it. Once the painting has been fully exposed
              and held for a beat it is released, and the page goes back to
              ordinary flow — everything below is a normal section that knows
              nothing about any of this. See `primitives/pinned.tsx`.
            */}
            <Cover>
              <Compatible />
              <DayOne />
            </Cover>
            <Manifesto />
            <Platform />
            <Migrate />
            <Alerts />
            <Engine />
            <Scale />
            <OneCommand />
            {/* Renders nothing when there is nobody to thank. */}
            <Sponsors />
          </main>
          {/*
            The page ends the way its middle began: one band slides over
            another. The footer is stuck to the bottom of the screen and the
            closing band is the opaque lid over it, which is why this one is
            wrapped in `Cover` — without a background the wordmark behind it
            shows straight through and the effect collapses into a z-index bug.

            The box around the pair is not tidying. A sticky element is clamped
            by its containing block, so this is what limits the footer's travel
            to the closing band: left as siblings inside the ruled frame, the
            frame itself would be the containing block and the footer would sit
            against the bottom of the screen from the first section onwards.
            See `sections/footer.tsx`.
          */}
          <div>
            <Cover>
              <Closing />
            </Cover>
            <SiteFooter />
          </div>
        </GridFrame>
      </div>
    </SmoothScroll>
  );
}
