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
 * ── The painting ────────────────────────────────────────────────────────────
 *
 * Raphael's School of Athens: everybody who ever worked something out, gathered
 * somewhere of their own choosing rather than summoned. The register the claim
 * underneath wants, which is about where a thing lives.
 *
 * ── The claim is about Rustrak, not about anyone else ────────────────────────
 *
 * It used to read "You already did the hard part. The SDK is in your code..."
 * and it was cut for arguing the wrong thing in the wrong place. The whole of
 * that claim was about how little it costs to switch, which is a question the
 * `Migrate` band exists to answer and answers better. Spent here, on the one
 * full screen the page gives to a single sentence with nothing competing, it
 * meant the thesis of the product was a note about somebody else's product.
 *
 * ── Why it is not a list ─────────────────────────────────────────────────────
 *
 * The replacement drafted first was "Everything your app can tell you, in one
 * process. Errors, logs, traces and releases on one timeline." It is a fine
 * sentence and it belongs to `Platform`, which sits immediately below and
 * spends five chapters on exactly that list. Two consecutive bands naming the
 * same five things means the second one has nothing left to announce.
 *
 * What this band owns instead is the one thing no other band says: the server
 * is yours and it lives where you put it. `Platform` owns the surface, `Scale`
 * owns the size, `Migrate` owns the cost of moving.
 *
 * ── It does not share anything with your app ─────────────────────────────────
 *
 * An earlier draft said "same box, same network, same database", which is
 * wrong on the last count and needlessly narrow on the first two. Rustrak keeps
 * its own database and is deployed wherever the operator wants it: a separate
 * VPS is an ordinary, expected setup. Copy anywhere on this page that implies
 * it rides along with the application is describing a deployment choice as if
 * it were a requirement.
 *
 * The examples that made that concrete ("a VPS, a Kubernetes cluster or a
 * machine in your office") were cut for length, not for accuracy. This band
 * sets one sentence at `display-lg` in a 20ch column over a full screen, and
 * scrubs it a word at a time, so every word costs both height and scroll
 * distance. At 160 characters the block ran about half again the height it is
 * drawn for.
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
