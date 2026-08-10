/**
 * System motion.
 *
 * Four rules, and all four come from this being an on-call tool rather than a
 * showcase. At three in the morning, with an alert open, nobody wants to watch
 * an animation:
 *
 *   1. Animate to explain cause and effect, never to decorate. If removing the
 *      animation loses no information, it should not be there.
 *   2. Only `transform` and `opacity` where possible: the GPU moves those, and
 *      they do not force the browser to lay the page out again.
 *   3. Never `transition-all`. Properties are listed by hand, because `all`
 *      ends up animating things nobody asked for and it is expensive.
 *   4. The response to a press is immediate: 70ms. Past 150ms it stops feeling
 *      like the control responding and starts feeling like the app being slow.
 *
 * The durations and curves are IBM Carbon's "productive" scale, the one meant
 * for dense software; they live in `styles/tokens.css`.
 */

/**
 * A state change that does not move: hover, focus, selection.
 *
 * It includes `transform` so that the press shares this transition instead of
 * declaring a second `transition-property` that would override it. And it
 * includes `box-shadow` because in this system a control's hairline **is** an
 * inset shadow: without it, a secondary button would change hairline in a jump.
 */
export const interactiveTransition = [
  'transition-[color,background-color,box-shadow,transform]',
  'duration-instant ease-standard',
].join(' ');

/**
 * Sinking on press.
 *
 * 3% of a 34px control is one pixel per side: visible, not dizzying. It rides
 * on `transform`, so it reorders nothing around it.
 *
 * Under reduced motion it does not shrink: the global override leaves the
 * transition at near zero, and the resulting hard snap is exactly what annoys
 * someone who asked for less movement.
 */
export const pressScale = 'active:scale-97 motion-reduce:active:scale-100';

/**
 * Short version for small pieces.
 *
 * The 3% is a percentage, not a distance: on a 140px button it is four pixels
 * and reads; on the 30px square in a table row it is 0.9px and nobody notices.
 * What has to stay constant is what is perceived.
 */
export const pressScaleSmall = 'active:scale-90 motion-reduce:active:scale-100';

/**
 * A floating surface arriving: tooltip, popover, menu.
 *
 * It enters braking and leaves accelerating, which is how real things move.
 * Base UI sets the origin in `--transform-origin`, anchored to the trigger, so
 * the panel grows from where it was opened and not from its own centre.
 */
export const popTransition = [
  'origin-(--transform-origin)',
  'transition-[transform,opacity] duration-fast',
  'data-starting-style:scale-95 data-starting-style:opacity-0',
  'data-starting-style:ease-entrance',
  'data-ending-style:scale-95 data-ending-style:opacity-0',
  'data-ending-style:ease-exit',
].join(' ');
