/**
 * The system's motion.
 *
 * Four rules, and all four come from this being a tool people work in rather
 * than a shop window:
 *
 *   1. Motion explains cause and effect, never decorates. If removing the
 *      animation loses no information, it should not be there.
 *   2. Only the compositor-friendly properties when there is a choice: the GPU
 *      moves those and they do not force the browser to lay the page out again.
 *   3. Never `transition-all`. Properties are listed by hand, because `all`
 *      ends up animating things nobody asked for, and it is expensive.
 *   4. The answer to a press is immediate: 70 ms. Past 150 ms it stops feeling
 *      like the control responding and starts feeling like the app being slow.
 *
 * The durations and curves are IBM Carbon's `productive` scale, in
 * `styles/tokens.css`.
 *
 * ---------------------------------------------------------------------------
 * ONE RULE OUTRANKS THE REST, because getting it wrong silently killed every
 * animation in this package once already:
 *
 *   **Tailwind 4 never writes `transform`.** `scale-97`, `translate-x-*` and
 *   `rotate-180` compile to the *individual* `scale`, `translate` and `rotate`
 *   properties. So `transition-[transform]` transitions a property that never
 *   changes: the value still jumps to its new state, it just jumps instantly,
 *   with no easing and no duration. Nothing errors and nothing looks broken in
 *   a screenshot -- it only feels dead.
 *
 * Every list below names the individual properties. `motion.test.ts` fails if
 * the word `transform` shows up inside a `transition-[…]` anywhere in `src`.
 * ---------------------------------------------------------------------------
 */

/**
 * A state change that does not move the element: hover, focus, selection,
 * severity, and the press and chevron flip that ride along with it.
 *
 * There can only be one of these per element. `transition-property` is a single
 * declaration, so a second `transition-[…]` class on the same element replaces
 * this one rather than adding to it -- which is why the press and the flip
 * below are bare state classes with no transition of their own.
 */
export const interactiveTransition = [
  'transition-[color,background-color,border-color,box-shadow,opacity,scale,rotate]',
  'duration-instant ease-standard',
].join(' ');

/**
 * The sink on press.
 *
 * 3 % of a 32 px control is one pixel a side: visible, not queasy. It rides on
 * `scale`, so nothing beside it reflows.
 *
 * With reduced motion it does not shrink at all: the global override leaves the
 * transition at almost zero, and a hard jump is exactly what somebody who asked
 * for less movement did not want.
 */
export const pressScale = 'active:scale-97 motion-reduce:active:scale-100';

/** The short version, for small pieces: icon buttons, chips, rail items. */
export const pressScaleSmall = 'active:scale-90 motion-reduce:active:scale-100';

/**
 * The sink for a control that opens a popup.
 *
 * Base UI opens on pointer-down and hands pointer capture to the popup, so
 * `:active` never lands on the trigger: pressing a menu button gave no feedback
 * at all. It does set `data-pressed`, and it keeps it set for as long as the
 * popup is open -- which turns out to be the better signal anyway. The button
 * is not being pressed, it is *holding something open*, and staying sunk for
 * that whole time is what says so. With `chevronFlip` it replaces the press
 * Base UI legitimately swallows.
 *
 * Only for popup triggers. On a `Toggle`, `data-pressed` means *selected*, and
 * a selected segment that stays shrunk reads as broken.
 */
export const pressScaleTrigger = [
  pressScale,
  'data-pressed:scale-97 motion-reduce:data-pressed:scale-100',
].join(' ');

/**
 * The chevron on a control that opens a panel.
 *
 * It turns over rather than swapping to a different glyph: the rotation is what
 * says the thing below is the same thing, opened. The element that owns
 * `data-popup-open` has to carry `group`.
 *
 * It brings its own transition, unlike the press. Transitions do not inherit,
 * and the chevron is a child of the button rather than the button itself, so
 * relying on `interactiveTransition` up on the parent leaves the rotation
 * snapping through 180 degrees in a single frame -- which is exactly what it
 * did until this line existed.
 *
 * `moderate` and not `instant`: 180 degrees is a long way for 70 ms, and at
 * that speed the turn reads as the glyph being swapped for a different one
 * rather than as the same one turning over.
 */
export const chevronFlip = [
  'transition-[rotate] duration-moderate ease-standard',
  'group-data-popup-open:rotate-180',
].join(' ');

/*
 * The 4 px a popup travels back toward whatever opened it.
 *
 * Scaling from the anchored origin already puts the growth in the right corner,
 * but on its own it reads as "a panel faded in". The small slide is what makes
 * it read as "a panel came out of that button" -- and on the way out, as going
 * back into it.
 *
 * Written out one side at a time, twice, on purpose. Tailwind extracts class
 * names statically, so a variant stuck on with a template literal is a class it
 * never sees and a rule that is silently never generated. This package has
 * already been bitten once by a transition that compiled to nothing; it is not
 * worth being clever here to save eight lines.
 */
const popEnterOffset = [
  'data-starting-style:data-[side=bottom]:-translate-y-1',
  'data-starting-style:data-[side=top]:translate-y-1',
  'data-starting-style:data-[side=right]:-translate-x-1',
  'data-starting-style:data-[side=left]:translate-x-1',
].join(' ');

const popExitOffset = [
  'data-ending-style:data-[side=bottom]:-translate-y-1',
  'data-ending-style:data-[side=top]:translate-y-1',
  'data-ending-style:data-[side=right]:-translate-x-1',
  'data-ending-style:data-[side=left]:translate-x-1',
].join(' ');

/**
 * A floating surface appearing: tooltip, dropdown, menu, popover.
 *
 * It arrives braking and leaves accelerating, which is how real things move,
 * and it leaves faster than it arrives: 150 ms in, 110 ms out. Something you
 * asked to see deserves the time to be seen arriving; something you have
 * dismissed should get out of the way. Both numbers are from the scale, and the
 * exit overrides the entry's duration and curve through `data-ending-style`,
 * which Base UI has applied by the time the exit is running.
 *
 * The origin comes from Base UI in `--transform-origin`, anchored to the
 * trigger, so the panel grows from where it was opened and not from its own
 * centre.
 */
export const popTransition = [
  'origin-(--transform-origin)',
  'transition-[opacity,scale,translate] duration-moderate ease-entrance',
  'data-starting-style:scale-95 data-starting-style:opacity-0',
  popEnterOffset,
  'data-ending-style:scale-95 data-ending-style:opacity-0',
  popExitOffset,
  'data-ending-style:duration-fast data-ending-style:ease-exit',
].join(' ');

/**
 * An indicator that slides from one tab to the next.
 *
 * The only animation in the system that lasts longer than instant: it covers
 * distance, and at 70 ms a 200 px jump does not read as travel, it reads as a
 * flicker. The travel is what says where you came from.
 */
export const slideTransition =
  'transition-[translate,width] duration-moderate ease-standard';

/**
 * A line of text that replaces itself: a live count, "3 min ago", a run that
 * just finished.
 *
 * Applied to an element with a `key`: React unmounts and remounts it, so the
 * animation restarts on every handover. The `key` should be the state, not the
 * rendered string, so "2 min ago" becoming "3 min ago" does not re-animate.
 */
export const swapAnimation = 'animate-swap-in motion-reduce:animate-none';
