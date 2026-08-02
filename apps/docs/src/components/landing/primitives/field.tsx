import { cn } from '@/lib/utils';

/**
 * The lime field: the brand's «Amanecer» surface, alive.
 *
 * ## What it is
 *
 * `rustrak-brand`, `brand/guidelines/logo.md` specifies the field in three layers:
 * five blurred radial blobs, a displacement map, then grain in two passes. These are
 * those five blobs — same centres, same radii, same colours, same opacities, same
 * roles. Three of them are light and two are ink, and the ink pair is the part that
 * is easy to leave out and cannot be: light on a dark ground only ever adds up, so
 * without something digging the darkness back out the whole field settles into the
 * flat olive wash the guidelines warn about.
 *
 * The ceiling is obeyed. Nothing here is ever lighter than `lime-400`; going up to
 * lime-300 makes the lit area read as dirty white and the image stops being
 * Rustrak's.
 *
 * ## What is not reproduced, and what stands in for it
 *
 * The displacement map and the grain are SVG filters, and a filter scales with the
 * element it is on. The brand repo is explicit that the deliverable for this field is
 * a raster at its final size, because the grain's frequency is in user units and only
 * means what it says when one unit is one pixel. A filter stretched across a surface
 * sized by the viewport would give a different texture at every window width, and an
 * animated one would re-run over the whole screen every frame.
 *
 * What the displacement layer was *for*, though, was making the field look bent
 * rather than drawn — the guidelines' words are that it should stop looking like a
 * CSS gradient. That job is done here by the shape of each blob and by what the
 * animation does to it, which costs nothing at all:
 *
 * 1. **The light is off-centre inside its own box.** `closest-side at 38% 44%` rather
 *    than a centred circle, so each blob is a lopsided ellipse with an uneven
 *    falloff. This is what gives rotation something to do — rotating a symmetrical
 *    radial gradient is a no-op you can watch the compositor perform for nothing.
 * 2. **The two axes scale independently.** A blob goes from a wide horizontal smear
 *    at `scale(1.3, 0.85)` to a tall column at `scale(0.86, 1.3)` and back, which is
 *    a genuine change of silhouette rather than the same shape at a different size.
 * 3. **It rotates.** ±20° or so, which on a lopsided ellipse swings where the bright
 *    part of it sits.
 *
 * Five of those overlapping, each on its own schedule, and the outline of the lit
 * region is never the same shape twice. That is the effect the displacement map buys
 * on a poster, arrived at from the other direction.
 *
 * ## What it replaced
 *
 * Three ASCII-rendered paintings on canvas — hero, manifesto and closing — plus the
 * 846 lines that drew them and the scrims that existed to protect type from them.
 * This is the same job done with the brand's own surface instead of with somebody
 * else's painting: no source file, no canvas, no three-second reveal, and no radial
 * pool tuned per breakpoint to hold a sentence above 4.5:1 on top of a picture.
 *
 * ## Why five elements and not one background
 *
 * The blobs move, and a `background` with five `radial-gradient()` layers cannot be
 * animated usefully: the centres are written as `at 20% 14%` inside the gradient
 * function and no property moves them, while `background-position` slides the painted
 * layer as a unit, which reads as a texture being dragged rather than as light
 * shifting. As elements they animate on `transform` and `opacity`, both composited,
 * so the whole surface runs off the main thread and nothing repaints.
 */
const BLOBS = [
  // The three lights, in the brand's order.
  { x: 20, y: 14, r: 46, color: '#c5f11e', drift: 'drift-a' },
  { x: 40, y: 30, r: 36, color: 'rgba(174, 216, 0, 0.95)', drift: 'drift-b' },
  { x: 6, y: 48, r: 30, color: 'rgba(150, 189, 0, 0.9)', drift: 'drift-c' },
  // The two that are ink, and exist to excavate the darkness back out.
  { x: 78, y: 74, r: 62, color: '#030303', drift: 'drift-d' },
  { x: 58, y: 96, r: 46, color: 'rgba(3, 3, 3, 0.95)', drift: 'drift-e' },
] as const;

/**
 * Where the light sits inside each blob's box.
 *
 * One shared value rather than five, because the variety comes from the animation
 * rather than from the artwork: five different off-centres would be five arbitrary
 * numbers doing what one number plus five rotations already does.
 */
const ORIGIN = '38% 44%';

export function Field({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden bg-[#030303]',
        className,
      )}
    >
      {BLOBS.map((blob) => (
        <div
          key={blob.drift}
          className={cn('absolute', blob.drift)}
          style={{
            width: `${blob.r * 2}%`,
            height: `${blob.r * 2}%`,
            left: `${blob.x - blob.r}%`,
            top: `${blob.y - blob.r}%`,
            background: `radial-gradient(closest-side at ${ORIGIN}, ${blob.color}, transparent)`,
          }}
        />
      ))}
    </div>
  );
}
