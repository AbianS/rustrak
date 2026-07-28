import { LandingNav } from './nav/nav';
import { GridFrame } from './primitives/grid';
import { Cover } from './primitives/pinned';
import { Alerts } from './sections/alerts';
import { Closing } from './sections/closing';
import { Compatible } from './sections/compatible';
import { DayOne } from './sections/day-one';
import { Engine } from './sections/engine';
import { SiteFooter } from './sections/footer';
import { Hero } from './sections/hero/hero';
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
 * — see the block in `src/app/globals.css`. Everything that enters starts on
 * mount (`useStarted`); there is no opening animation.
 *
 * The order is an argument, not a list: what it is (hero), what already talks
 * to it (compatible), the claim (manifesto), the proof (platform), the cost of
 * acting on it (migrate), how it is built and what that buys (engine, scale),
 * and how to start (one command). Each band answers the question the one above
 * it raises, which is why `Migrate` sits immediately after the product screens.
 *
 * `Engine` and `Scale` are a pair and have to stay adjacent in that order: the
 * first takes the server apart and the second states the bill. Numbers that
 * arrive after their explanation read as a consequence; the same numbers alone
 * read as marketing.
 *
 * Two bands carry a painting — hero and manifesto — and they are deliberately
 * spread. Two in a row and the ASCII stops being a gesture and becomes
 * wallpaper.
 */
export function LandingPage() {
  return (
    <SmoothScroll>
      <div className="landing-root relative min-h-screen antialiased">
        <LandingNav />
        {/* The hero sits outside the ruled frame — the one band with no
            vertical rules, so the page opens as open space and the structure
            arrives with the first argument below it. Opaque and on the upper
            layer, because the pinned band below is pulled up behind this one's
            tail and would otherwise paint straight over it. */}
        <div className="relative z-10 bg-background">
          <Hero />
        </div>
        <GridFrame>
          <main>
            {/* `Compatible` is the lid: it slides up and off to uncover the
                painting held behind it, then releases and the page goes back to
                ordinary flow. See `primitives/pinned.tsx`. */}
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
            The page ends the way its middle began: the footer is stuck to the
            bottom of the screen and the closing band is the opaque lid over it.

            The box around the pair is load-bearing, not tidying. A sticky
            element is clamped by its containing block, so this is what limits
            the footer's travel to the closing band — left as siblings inside
            the ruled frame, the frame would be the containing block and the
            footer would sit against the bottom of the screen from the first
            section onwards. See `sections/footer.tsx`.
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
