'use client';

import { COS30, facePoints, type Point, SIN30, sx, sy, U } from './iso';

/**
 * The two solids every part in the machine is drawn out of, and the palette
 * they are shaded with.
 */

/* -------------------------------------------------------------------------- */
/* Solids                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The three faces of an extruded solid a viewer can see, and only those three.
 *
 * Which three is fixed by the projection rather than chosen: the top, the face
 * at maximum `z` (left on screen) and the face at maximum `x` (right). Drawing
 * the hidden three turns the solid into a Necker cube and the eye cannot settle
 * on which way it points.
 *
 * The tones are one colour at three strengths, and the ratio is fixed for every
 * solid in the scene. A consistent light source is most of what separates a
 * drawing that looks made from one that looks generated.
 */
export const TOP = 1;
export const LEFT = 0.6;
export const RIGHT = 0.38;

/**
 * A face's tone, as an opaque colour rather than as an opacity.
 *
 * The three numbers above started life as `fill-opacity`, which is the obvious
 * way to shade three faces from one colour and was fine while nothing in the
 * drawing overlapped anything else. It stopped being fine the moment the parts
 * were spread through the volume: a face at 0.38 alpha is *translucent*, so the
 * expansion card in front of the cooler showed the cooler through it, and the
 * whole machine took on the look of being moulded in smoked glass.
 *
 * Mixing toward black instead gives the same three steps of the same hue and
 * leaves every face opaque, so a solid in front of another solid hides it —
 * which is the entire job of a solid.
 */
const shade = (color: string, tone: number) =>
  tone >= 1
    ? color
    : `color-mix(in oklab, ${color} ${Math.round(tone * 100)}%, black)`;

/**
 * The machine's own two tones, and why they are literals rather than theme
 * variables.
 *
 * Everything in this drawing was reading as one dark mass, and the measurement
 * says why: the parts were `--secondary` at L 0.22, the box interior `--card` at
 * 0.18, the band behind it `--surface-soft` at 0.153. Three surfaces inside a
 * seven-percent spread of lightness. Nothing in it could separate from anything
 * else, so the only thing a reader could actually see was whichever part was
 * lit in lime — which is why the interior looked like a smudge with one green
 * shape in it.
 *
 * The fix is not more contrast everywhere, it is a *scale*: the case is dark,
 * and the machine inside it is made of metal, which is lighter. The theme's
 * greys have nothing at that level — they stop at `--border`, 0.26 — because
 * the app has no use for one. This drawing does, so it carries its own.
 *
 * Safe as literals because the landing is dark-locked (see the `.landing-root`
 * block in `globals.css`); there is no light variant for these to be wrong in.
 */
export const METAL = 'oklch(0.47 0 0)';
export const EDGE = 'oklch(0.68 0 0)';
export const BOARD_FILL = 'oklch(0.21 0 0)';

/**
 * Screen half-axes of a unit circle lying flat, and the `√2` is the whole
 * subtlety.
 *
 * A circle of radius `r` parametrises to `cos θ − sin θ` across the screen and
 * `cos θ + sin θ` down it, and both of those have amplitude `√2` rather than 1.
 * Drop it and every disc comes out at 71% of its width, which does not read as
 * an error — it reads as a slightly wrong drawing you cannot put your finger
 * on. It is the same factor the ground lattice needs for its diamond corners.
 */
export const ELL_RX = Math.SQRT2 * COS30 * U;
export const ELL_RY = Math.SQRT2 * SIN30 * U;

/**
 * A rectangular solid, sized independently along `x` and along `z`.
 *
 * The independent extents are the point. A single `size` gives square
 * footprints, square footprints give five parts of the same shape, and five
 * parts of the same shape is the thing this interior was rebuilt to stop being.
 * A memory card is 0.09 by 0.92; a drive is 1.15 by 0.62; they cannot both be a
 * cube.
 */
export function Box({
  cx,
  cz,
  w,
  d,
  y = 0,
  h,
  fill,
  stroke,
}: {
  cx: number;
  cz: number;
  /** Extent along world `x`. */
  w: number;
  /** Extent along world `z`. */
  d: number;
  y?: number;
  h: number;
  fill: string;
  stroke: string;
}) {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const z0 = cz - d / 2;
  const z1 = cz + d / 2;
  const top = y + h;

  const faces: [Point[], number][] = [
    [
      [
        [x0, top, z0],
        [x1, top, z0],
        [x1, top, z1],
        [x0, top, z1],
      ],
      TOP,
    ],
    [
      [
        [x0, top, z1],
        [x1, top, z1],
        [x1, y, z1],
        [x0, y, z1],
      ],
      LEFT,
    ],
    [
      [
        [x1, top, z1],
        [x1, top, z0],
        [x1, y, z0],
        [x1, y, z1],
      ],
      RIGHT,
    ],
  ];

  return (
    <>
      {faces.map(([points, tone]) => (
        <polygon
          key={facePoints(points)}
          points={facePoints(points)}
          fill={shade(fill, tone)}
          stroke={stroke}
          strokeWidth={1}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </>
  );
}

/** A disc lying flat: a fan, a flange, a seal. */
export function Disc({
  cx,
  cz,
  y,
  r,
  lit,
  filled = true,
  opacity = TOP,
}: {
  cx: number;
  cz: number;
  y: number;
  r: number;
  lit: boolean;
  filled?: boolean;
  opacity?: number;
}) {
  return (
    <ellipse
      cx={sx(cx, cz)}
      cy={sy(cx, y, cz)}
      rx={r * ELL_RX}
      ry={r * ELL_RY}
      fill={filled ? shade(lit ? 'var(--primary)' : METAL, opacity) : 'none'}
      stroke={lit ? 'var(--primary)' : EDGE}
      strokeWidth={1}
      vectorEffect="non-scaling-stroke"
    />
  );
}
