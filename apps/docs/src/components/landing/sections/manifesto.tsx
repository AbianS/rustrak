import { AsciiField } from '../ascii-field';
import { Deferred } from '../primitives/deferred';
import { Heading } from '../primitives/heading';
import { Pinned } from '../primitives/pinned';

/**
 * The page's central claim, on its own, over a painting that refuses to move.
 *
 * Everything above this band is setup — what the product is, which SDKs reach
 * it — and everything below is proof. This is the one place the argument is
 * stated outright with nothing competing: no panel, no cells, no numbers. A
 * page of showcases needs a moment where it stops showing and simply says the
 * thing, or the reader never finds out what they were being shown.
 *
 * It is not wrapped in a `Band`. Bands sit inside the ruled frame and close
 * against it with a rule; this one is the frame's own floor, held still while
 * the chapters climb over it, so a hairline across the bottom would be drawing
 * a lid on the one element that is meant to have no bottom.
 *
 * Raphael's School of Athens: everybody who ever worked something out, gathered
 * somewhere of their own choosing rather than summoned. The register the claim
 * underneath wants, which is about where a thing lives.
 *
 * What this band owns is the one thing no other band says: the server is yours
 * and it lives where you put it. `Platform` owns the surface, `Scale` the size,
 * `Migrate` the cost of moving — so the claim here must not be a list of
 * features (that is `Platform`, immediately below) or a note about how cheap it
 * is to switch (that is `Migrate`). Either spends the one full screen the page
 * gives to a single sentence on a band that argues it better.
 *
 * It also must not imply Rustrak rides along with your application. It keeps
 * its own database and is deployed wherever the operator wants it; a separate
 * VPS is an ordinary setup, so "same box, same network, same database" is
 * describing a deployment choice as if it were a requirement.
 *
 * Keep it short. One sentence at `display-lg` in a 20ch column, scrubbed a word
 * at a time, means every word costs both height and scroll distance — at 160
 * characters the block runs about half again the height it is drawn for.
 */
export function Manifesto() {
  return (
    <Pinned className="bg-[oklch(0.105_0_0)]">
      <Deferred className="absolute inset-0" rootMargin="900px">
        {/* Turned down: this sits behind type rather than behind a product
            panel, so it wants to be read as texture rather than looked at. */}
        <AsciiField
          source="/school-of-athens.txt"
          className="inset-y-0"
          intensity={1}
        />
      </Deferred>

      {/* Pools darkness under the sentence only. The hero's scrim lives in
          `globals.css` because it has to change shape with a headline that goes
          from two lines to four; this one is a single centred pool at every
          size, so it stays here next to the type it protects. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(64%_58%_at_50%_46%,rgba(8,8,8,0.93),rgba(8,8,8,0.74)_55%,rgba(8,8,8,0.4)_100%)]"
      />

      <div className="relative flex h-full items-center px-5 sm:px-10">
        <Heading
          className="display-lg mx-auto max-w-[20ch] text-center"
          lead="Run it wherever you want."
          rest="Rustrak is one server you deploy on your own infrastructure. Your event data never leaves it."
          scrub
        />
      </div>
    </Pinned>
  );
}
