import { Field } from '@/components/frame/field';
import { Heading } from '../primitives/heading';
import { Pinned } from '../primitives/pinned';

/**
 * The page's central claim, on its own, on a band that refuses to move.
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
      <Field />
      {/* Pools darkness under the sentence only. Much lighter than the pool the ASCII
          painting needed: a field has no detail at the frequency type lives at, so
          what has to be held back is the lit corner and nothing else. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(62%_56%_at_50%_50%,rgba(6,6,6,0.9),rgba(6,6,6,0.62)_58%,rgba(6,6,6,0.12)_100%)]"
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
