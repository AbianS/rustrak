/**
 * There is one focus ring in the whole application: 2px of lime at 40%. It is
 * shared as a constant rather than repeated in every recipe so that a second,
 * slightly different ring does not appear six months from now.
 *
 * It uses `ring`, which in Tailwind 4 is drawn **outside** the box, while a
 * control's hairline uses `inset-ring`, inside it. Both are box-shadows and
 * compose without clobbering each other, so a secondary button keeps its
 * hairline while focused instead of losing it.
 */
export const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * For boxes that receive focus through a child: the field lights up when the
 * `input` inside it takes focus.
 */
export const focusRingWithin =
  'outline-none focus-within:ring-2 focus-within:ring-ring';
