'use client';

/**
 * The isometric projection the whole drawing is built on, and the world
 * dimensions of the cube itself.
 *
 * Everything here is pure arithmetic over world coordinates, which is why it is
 * a leaf module: the solids, the board and the five parts all measure
 * themselves against these, and none of them needs to know about the others.
 */

/* -------------------------------------------------------------------------- */
/* Projection                                                                  */
/* -------------------------------------------------------------------------- */

export const COS30 = Math.cos(Math.PI / 6);
export const SIN30 = 0.5;

/**
 * Pixels per world unit.
 *
 * Raised from 32, together with a tighter ground plane, because the drawing was
 * rendering far smaller than the space it was given. The frame has to be wide
 * enough for the label gutter and tall enough for the lid's travel, and both of
 * those are empty most of the time — so the cube was occupying under half the
 * box it was drawn in and then being scaled down again to fit beside the panel.
 */
export const U = 40;

/**
 * Where world (0, 0, 0) lands in the viewBox.
 *
 * Framed from the *open* state, never the shut one: fully open the lid has
 * risen and the two near walls have travelled out along their own axes, so a
 * frame chosen while the cube was closed clips all three at exactly the moment
 * the drawing finishes opening.
 *
 * ── What the ceiling actually is ────────────────────────────────────────────
 *
 * `(R + H + LID_RISE) · U`, and it is worth writing out because two plausible
 * answers are both wrong and this frame was tightened against each of them in
 * turn.
 *
 * It is not `(H + LID_RISE) · U`, the height the lid rises to. A face's topmost
 * *point* is its back corner, where `x + z` reaches `−2R`, and `sy` subtracts
 * `(x + z) · sin30` — so the corner sits a further `R · U` up the screen from
 * the centre of the face it belongs to.
 *
 * And it is not `(R + H) · U`, that corner on the stationary case, because the
 * lid carries the same corner and then translates it up by `LID_RISE · U` on
 * top. The three add.
 *
 * The trap is that you cannot see any of this in a measurement taken while the
 * box is shut, which is what happened here: the drawing was measured at the
 * start of the section, reported 170 units of unused height, was tightened to
 * suit, and lost the top corner of the lid for the whole of the open state.
 * Measure a scrubbed drawing at the extreme of its scrub, not at its rest.
 */
export const OX = 294;
export const OY = 264;

export const sx = (x: number, z: number) => OX + (x - z) * COS30 * U;
export const sy = (x: number, y: number, z: number) =>
  OY + ((x + z) * SIN30 - y) * U;

export type Point = [x: number, y: number, z: number];

export const vertex = ([x, y, z]: Point) =>
  `${sx(x, z).toFixed(1)},${sy(x, y, z).toFixed(1)}`;

export const facePoints = (points: Point[]) => points.map(vertex).join(' ');

export const line = (from: Point, to: Point) =>
  `M${vertex(from)} L${vertex(to)}`;

/**
 * The transform that lays flat 2D art onto a horizontal plane, centred on a
 * given world point.
 *
 * Anything drawn inside is authored in world-sized units on ordinary graph
 * paper and comes out lying in the isometric plane. `vector-effect` is
 * mandatory in there: the matrix scales by `U`, so a hairline would otherwise
 * render 32px thick.
 */
export const planeAt = (x: number, y: number, z: number) =>
  `matrix(${(COS30 * U).toFixed(4)} ${(SIN30 * U).toFixed(4)} ${(-COS30 * U).toFixed(4)} ${(SIN30 * U).toFixed(4)} ${sx(x, z).toFixed(2)} ${sy(x, y, z).toFixed(2)})`;

/* -------------------------------------------------------------------------- */
/* The box                                                                     */
/* -------------------------------------------------------------------------- */

/** Half the cube's footprint, and its height. */
export const R = 2.1;
export const H = 2.6;

/** How far the lid rises and the two near walls travel when fully open. */
export const LID_RISE = 1.15;
export const WALL_OUT = 1.9;

/**
 * The same travel on a portrait frame, shortened.
 *
 * The walls are what set the drawing's width — they leave along the two screen
 * diagonals, so every unit of travel costs `cos30 · U` at each end and the
 * frame has to be wide enough for both. At 1.9 the open drawing is half again
 * as wide as it is tall, which on a portrait stage is paid for in scale: the
 * frame letterboxes by width and the extra width is dead space above and below
 * the machine.
 *
 * Shortening the travel there buys that back. The gesture is the same one and
 * reads the same at a glance; what changes is that the frame comes out very
 * nearly square, and the cube inside it about a seventh larger on the same
 * phone. On a screen this size that is the difference between seeing the five
 * parts and knowing they are there.
 */
export const WALL_OUT_TALL = 1.15;

/**
 * Half-extent of the ground lattice, and its spacing.
 *
 * The lattice is a diamond on screen, and its half-width is `2 · GROUND ·
 * cos30 · U` rather than `GROUND · cos30 · U`: the widest points are the two
 * corners where `x − z` reaches `±2 · GROUND`. Getting that factor wrong is
 * what made the first pass fade the ground out to nothing right at the cube's
 * own edge, so the object stood on a vignette barely wider than itself.
 */
export const GROUND = 3.4;
export const CELL = 0.65;

/** Screen half-axes of the lattice diamond, for the mask that fades it out. */
export const GROUND_RX = 2 * GROUND * COS30 * U;
export const GROUND_RY = 2 * GROUND * SIN30 * U;

/** The board everything is mounted on: half-extent, and its top surface. */
export const BOARD = 1.75;
export const DECK = 0.08;
