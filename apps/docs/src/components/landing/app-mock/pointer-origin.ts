/**
 * Where the pointer that drives the hero's product panel comes from, and when.
 *
 * It is born at the end of the rotating claim in the `h1`, right where the
 * caret is, and drifts down into the panel. That spot is the reason the move
 * works: the claim is the one thing already moving when the reader arrives, so
 * the gesture leaves from where their eye already is and carries it to the
 * product. Starting from the wordmark was tried and was worse — nobody is
 * looking at the nav.
 *
 * A module rather than a context because the two ends need to agree on exactly
 * two facts: one position, read once, and one moment. A context for that would
 * mean a provider, a ref threaded through the headline's markup, and a pointer
 * detail in the signature of components with no other reason to know about it.
 * So the spot labels itself with an attribute and the pointer looks it up when
 * it launches; both ends measure time from `useStarted`.
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
 * at 62ms, so the claim finishes setting itself at about 0.7s and holds until
 * about 3.1s. The pointer has to be clear of the line before the phrase it sits
 * at the end of starts disappearing from under it, so it leaves mid-hold.
 */
export const POINTER_BIRTH = 2.5;

/**
 * How long the pointer takes to reach its first target.
 *
 * Much longer than an ordinary hop, and slow on purpose: it crosses most of the
 * screen while growing from a speck into a pointer, and it is the one move on
 * the page whose job is to be watched rather than understood. It also has
 * somewhere to be — the panel's own arrival finishes at about 3.9s, so this
 * puts the click a second after that, descending while the window settles.
 */
export const POINTER_FLIGHT = 2.5;

/**
 * Seconds after the pointer leaves before the headline draws its caret again.
 *
 * The caret simply fades back rather than being handed over as one continuous
 * piece of geometry. Two attempts were made at the latter — the bar dividing in
 * the line, and the pointer shedding a fragment mid-descent — and both failed
 * for the same reason: a morph only reads as a morph if the eye can follow it,
 * and a four-pixel bar is too small to follow while a much larger shape moves
 * in the other half of the screen. By the time this fires the pointer is down
 * in the panel and nobody is looking at the headline.
 *
 * Long enough that the pointer has arrived and pressed something first. Two
 * lime bars in flight at once is what would make the fade look like a mistake.
 */
export const CARET_RETURN = 3;
