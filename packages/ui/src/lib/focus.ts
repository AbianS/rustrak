/**
 * There is one focus ring in the whole application: 2 px of lime at 45 %.
 *
 * It is shared as a constant rather than repeated in every recipe so that a
 * second, slightly different ring does not appear six months from now.
 *
 * It uses `ring` and not a hand-rolled `box-shadow` because `ring` composes
 * with the component's own shadow: a floating popup keeps its `shadow-overlay`
 * while focused.
 *
 * Lime is the only colour the product owns that severity has not already
 * claimed. A red or amber ring on an error screen would read as another alarm.
 */
export const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * The same ring, drawn inside the element.
 *
 * For a control that sits flush inside a clipping parent -- the two halves of a
 * `SplitButton` inside its pill. `ring` is a `box-shadow` and grows outwards,
 * so an ancestor with `overflow-hidden` cuts it off on exactly the edges that
 * matter. Dropping the clip is not the answer either: it is what keeps the
 * seam between the halves shut and the corners clean.
 */
export const focusRingInset =
  'outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-ring';

/**
 * For boxes that take focus through a child: the field lights up when the
 * `input` inside it is focused.
 */
export const focusRingWithin = [
  'outline-none focus-within:border-border-brand',
  'focus-within:ring-2 focus-within:ring-ring-subtle',
].join(' ');
