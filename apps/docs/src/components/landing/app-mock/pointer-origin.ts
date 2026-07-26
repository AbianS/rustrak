/**
 * Where the pointer comes from, and when.
 *
 * ── It is born at the end of the headline ───────────────────────────────────
 *
 * The hero's product panel is driven by a pointer that clicks its way through
 * the app, and it does not fade in at its first target or slide in from an
 * edge. It appears at the end of the rotating claim in the `h1` — right after
 * the last lime word, where the caret is — and drifts down into the panel.
 *
 * That spot is the whole reason the move works. The claim is the one thing on
 * the page already moving when the reader arrives, so their eye is on it; the
 * pointer leaves from exactly there and carries that attention down to the
 * product. The alternative that was tried first was the wordmark in the nav,
 * and it was worse for a reason that is easy to state after the fact: nobody is
 * looking at the nav, so the gesture began somewhere the reader had to be told
 * to look.
 *
 * ── Why this is a module and not a context ──────────────────────────────────
 *
 * The two ends need to agree on exactly two facts: one position, read once, and
 * one moment. A context for that would mean a provider, a ref threaded through
 * the headline's markup, and a pointer detail showing up in the signature of
 * components that have no other reason to know about it.
 *
 * So the spot labels itself with an attribute and the pointer looks it up when
 * it launches. The timing is a constant, and both ends measure it from
 * `useStarted`, the same clock everything else on the page opens on.
 */

/**
 * Stamped on a zero-width marker at the end of the headline's claim. Read once,
 * by `Cursor`, at launch.
 */
export const POINTER_ORIGIN = 'data-pointer-origin';

/**
 * Seconds after the page starts at which the pointer leaves the headline.
 *
 * Timed against the typewriter, not guessed. `One binary.` is eleven characters
 * at 62ms, so the claim finishes setting itself at about 0.7s and then holds
 * for 2.4s before it begins deleting at about 3.1s. The pointer has to be clear
 * of the line before the phrase it is sitting at the end of starts disappearing
 * from under it, so it leaves in the middle of that hold.
 */
export const POINTER_BIRTH = 2.5;

/**
 * How long the pointer takes to reach its first target.
 *
 * Much longer than an ordinary hop, and slow on purpose. It is crossing most of
 * the screen while growing from a speck into a pointer, and it is the one move
 * on this page whose job is to be watched rather than understood. Rushed, it
 * reads as something being fired at the panel.
 *
 * It also has somewhere to be. The panel's own arrival finishes at about 3.9s,
 * and 2.5 plus 2.5 puts the click a second after that — descending while the
 * window settles, and pressing once it has.
 */
export const POINTER_FLIGHT = 2.5;

/**
 * Seconds after the pointer leaves before the headline draws its caret again.
 *
 * ── Why it simply fades back ────────────────────────────────────────────────
 *
 * Two attempts were made at giving the caret away and getting it back as one
 * continuous piece of geometry: the bar dividing in the line, and the pointer
 * shedding a fragment mid-descent that turned over and flew home. Both were
 * clever and both were ugly, and the reason is the same in each case. A morph
 * only reads as a morph if the eye can follow it, and a four-pixel bar in a
 * line of type is too small to follow while a much larger, much more
 * interesting shape is moving in the other half of the screen.
 *
 * So there is no trick. The bar leaves, and a few seconds later the caret is
 * simply back, on a fade. By then the pointer is down in the panel clicking
 * things and nobody is looking at the headline, which is exactly why nothing
 * needs to be explained: the two are far enough apart in time and space that
 * the reader never puts the question.
 *
 * Long enough that the pointer has arrived and pressed something before the
 * caret reappears. Two lime bars in flight at once is the one thing that would
 * make the fade look like a mistake.
 */
export const CARET_RETURN = 3;
