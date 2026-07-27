'use client';

import {
  type MotionValue,
  motion,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { DUR } from '../motion';

/**
 * The server, as one cube that opens.
 *
 * ── What this is, and the three attempts it took ────────────────────────────
 *
 * A single solid standing on a ground plane. Scrolling lifts its lid and swings
 * its two near walls away, and inside is a board with the five components the
 * event processor is built from bolted to it — a port panel, a bank of memory,
 * a drive, a cooler over the part that does the work, and a card plugged in
 * across the front.
 *
 * It took three goes because two things kept getting lost, and both are the
 * whole point:
 *
 * **It is one cube.** An earlier pass turned the machine *into* a stack of five
 * slabs, which is a different idea wearing the same clothes: the reader never
 * meets a server, they meet a pile. The server has to be a single recognisable
 * object first — closed, sealed, one thing — so that opening it means
 * something. You cannot open what was never shut.
 *
 * **It stands somewhere.** The first version had a ground plane and the second
 * did not, and without one the drawing is a diagram floating in a rectangle
 * rather than an object sitting in a place. The lattice, the fade at its edges
 * and the contact shadow are not decoration; they are what make the cube read
 * as having weight.
 *
 * ── The components are real ─────────────────────────────────────────────────
 *
 * Every piece inside is something in `apps/server/src`, named as the code names
 * it:
 *
 *   Admission control  `routes/ingest.rs` step 0 — `RateLimitService::check_quota`
 *                      runs before a single byte is decompressed and answers 429
 *                      with `Retry-After`. Work refused early is work the rest
 *                      of the machine never sees.
 *
 *   Envelope decoder   `ingest/decompression.rs` caps the body at 100MB, so a
 *                      zip bomb is rejected by size before it is inflated, and
 *                      `ingest/envelope.rs` splits the stream into eight typed
 *                      item kinds — Event, Transaction, Session, Sessions, Log,
 *                      Span, SpanV2Batch, Other — over an exhaustive,
 *                      compiler-checked match.
 *
 *   Durable spool      `ingest/storage.rs` writes the event body to a file and
 *                      `routes/ingest.rs` returns 200. This is the durable
 *                      handoff a queue broker exists to provide, done with the
 *                      filesystem, so a crash between the acknowledgement and
 *                      the processing cannot lose the event.
 *
 *   Digest workers     `tokio::spawn` on the same runtime in the same process,
 *                      plus `SessionAggregator` (minute buckets in memory behind
 *                      a cardinality cap, flushed on an interval) and
 *                      `AssemblyWorker` from `main.rs`. Dispatch runs through
 *                      the `Processors` registry in `digest/processors/mod.rs`:
 *                      one impl per route, RPITIT rather than `dyn`.
 *
 *   Fingerprint        `services/grouping.rs` — a deterministic key, SHA-256'd,
 *                      folding identical crashes onto one issue and incrementing
 *                      `digested_event_count` instead of writing another row.
 *
 * ── How it moves ────────────────────────────────────────────────────────────
 *
 * Two inputs, deliberately separate.
 *
 * `open` is continuous and comes from scroll position. At 0 the cube is shut and
 * there is nothing inside to see; through the first third the lid rises and the
 * near walls swing out; then the board arrives and the parts drop onto it one
 * after another, and their leader lines draw. It is a scrub, so it runs
 * backwards and the box closes.
 *
 * `active` is discrete and comes from which claim is being read. It decides
 * which component is lit. A claim is either being made or it is not, so there is
 * nothing continuous to map it onto — tying the highlight to the scrub would
 * leave a component half-lit for most of its section, and tying the opening to
 * the claim index would unpack the box in five visible jerks.
 *
 * It also decides what gets *out of the way*. The parts are spread through the
 * volume rather than lined up on the floor, so they stand in front of one
 * another; everything that is not the subject of the current claim drops to a
 * fraction of its opacity, which is the same thing the near walls do on the way
 * out and is what lets an arrangement chosen for depth stay readable.
 */

/* -------------------------------------------------------------------------- */
/* Projection                                                                  */
/* -------------------------------------------------------------------------- */

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;

/**
 * Pixels per world unit.
 *
 * Raised from 32, together with a tighter ground plane, because the drawing was
 * rendering far smaller than the space it was given. The frame has to be wide
 * enough for the label gutter and tall enough for the lid's travel, and both of
 * those are empty most of the time — so the cube was occupying under half the
 * box it was drawn in and then being scaled down again to fit beside the panel.
 */
const U = 40;

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
const OX = 294;
const OY = 264;

const sx = (x: number, z: number) => OX + (x - z) * COS30 * U;
const sy = (x: number, y: number, z: number) => OY + ((x + z) * SIN30 - y) * U;

type Point = [x: number, y: number, z: number];

const vertex = ([x, y, z]: Point) =>
  `${sx(x, z).toFixed(1)},${sy(x, y, z).toFixed(1)}`;

const facePoints = (points: Point[]) => points.map(vertex).join(' ');

const line = (from: Point, to: Point) => `M${vertex(from)} L${vertex(to)}`;

/**
 * The transform that lays flat 2D art onto a horizontal plane, centred on a
 * given world point.
 *
 * Anything drawn inside is authored in world-sized units on ordinary graph
 * paper and comes out lying in the isometric plane. `vector-effect` is
 * mandatory in there: the matrix scales by `U`, so a hairline would otherwise
 * render 32px thick.
 */
const planeAt = (x: number, y: number, z: number) =>
  `matrix(${(COS30 * U).toFixed(4)} ${(SIN30 * U).toFixed(4)} ${(-COS30 * U).toFixed(4)} ${(SIN30 * U).toFixed(4)} ${sx(x, z).toFixed(2)} ${sy(x, y, z).toFixed(2)})`;

/* -------------------------------------------------------------------------- */
/* The box                                                                     */
/* -------------------------------------------------------------------------- */

/** Half the cube's footprint, and its height. */
const R = 2.1;
const H = 2.6;

/** How far the lid rises and the two near walls travel when fully open. */
const LID_RISE = 1.15;
const WALL_OUT = 1.9;

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
const WALL_OUT_TALL = 1.15;

/**
 * Half-extent of the ground lattice, and its spacing.
 *
 * The lattice is a diamond on screen, and its half-width is `2 · GROUND ·
 * cos30 · U` rather than `GROUND · cos30 · U`: the widest points are the two
 * corners where `x − z` reaches `±2 · GROUND`. Getting that factor wrong is
 * what made the first pass fade the ground out to nothing right at the cube's
 * own edge, so the object stood on a vignette barely wider than itself.
 */
const GROUND = 3.4;
const CELL = 0.65;

/** Screen half-axes of the lattice diamond, for the mask that fades it out. */
const GROUND_RX = 2 * GROUND * COS30 * U;
const GROUND_RY = 2 * GROUND * SIN30 * U;

/* -------------------------------------------------------------------------- */
/* The machine inside                                                          */
/* -------------------------------------------------------------------------- */

/**
 * ── It is one machine, not five objects ─────────────────────────────────────
 *
 * The interior has been wrong twice, and both times for the same reason: the
 * five components were drawn as five separate things standing in a row on the
 * floor, evenly spaced, all the same size, all on one axis. First as identical
 * extruded cubes with a tiny symbol lying on each top face, then as five
 * distinct little machines — a valve, a manifold, a tank, a piston bank, a
 * press.
 *
 * The second was prettier and no more correct. A row of separate objects is a
 * bar chart with nicer marks on it: nothing touches anything, nothing is
 * plugged into anything, and the box around them is just a container they
 * happen to be inside. It does not look like the inside of a machine because it
 * is not one.
 *
 * What the inside of a machine actually looks like is a **board with things
 * mounted on it**. A computer is the obvious case and the right one here: a
 * motherboard lying flat, a cooler bolted to the middle of it, memory standing
 * in a row of slots, an expansion card plugged in edge-on across the front, a
 * drive bolted into a corner, and cable runs between them. Nothing is floating.
 * Everything is attached to something, and the thing it is attached to is what
 * makes the whole assembly one object.
 *
 * That also fixes the composition. The parts now differ in every dimension that
 * was previously uniform:
 *
 *   footprint   the cooler is a square block, the memory is four thin cards,
 *               the card is one long thin plate, the drive is a squat slab
 *   height      0.44 at the I/O panel, 1.02 at the top of the card
 *   axis        the memory stands across `z`, the card lies along `x`
 *   depth       from `x + z = −1.7` at the back to `+0.65` at the front
 *
 * ── Which means things get in front of other things ─────────────────────────
 *
 * Spreading parts through the volume is what makes the drawing read as three
 * dimensional, and it has a cost that a row on the floor never had: the
 * expansion card at the front stands directly between the eye and the left of
 * the cooler, and the cooler stands in front of the drive. A part can now be
 * the subject of the claim being read and be partly hidden behind another one.
 *
 * So the drawing ghosts. When a claim is being made, every part that is not its
 * subject drops to a fraction of its opacity — the same move the box itself
 * makes when its near walls fade on the way out, for the same reason and with
 * the same feeling. It is not a highlight effect bolted on; it is the drawing
 * getting out of its own way, and it is what lets the parts be arranged for
 * depth instead of for visibility.
 */

/** The board everything is mounted on: half-extent, and its top surface. */
const BOARD = 1.75;
const DECK = 0.08;

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
const TOP = 1;
const LEFT = 0.6;
const RIGHT = 0.38;

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
const METAL = 'oklch(0.47 0 0)';
const EDGE = 'oklch(0.68 0 0)';
const BOARD_FILL = 'oklch(0.21 0 0)';

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
const ELL_RX = Math.SQRT2 * COS30 * U;
const ELL_RY = Math.SQRT2 * SIN30 * U;

/** Screen position of a world point, as numbers rather than as a string. */
const px = ([x, , z]: Point) => sx(x, z);
const py = ([x, y, z]: Point) => sy(x, y, z);

/**
 * A rectangular solid, sized independently along `x` and along `z`.
 *
 * The independent extents are the point. A single `size` gives square
 * footprints, square footprints give five parts of the same shape, and five
 * parts of the same shape is the thing this interior was rebuilt to stop being.
 * A memory card is 0.09 by 0.92; a drive is 1.15 by 0.62; they cannot both be a
 * cube.
 */
function Box({
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
function Disc({
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

/* -------------------------------------------------------------------------- */
/* The five parts, as things bolted to a board                                 */
/* -------------------------------------------------------------------------- */

/**
 * Where each part meets the board: its footprint, printed on the surface.
 *
 * ── This is what replaced the cables ────────────────────────────────────────
 *
 * There were three cable runs slung between the parts, and they were the worst
 * thing in the drawing. Two reasons, and the second is the useful one.
 *
 * They looked wrong: a cable needs a dark casing to read as passing *in front
 * of* what it crosses, so the boldest, darkest marks in the whole interior were
 * three curves floating above it, drawn heavier than any of the machinery they
 * were supposed to be subordinate to.
 *
 * And they were the wrong idea. A cable is what you use when two things are
 * *apart*. Everything here is bolted to the same board, and on a board the
 * connection is not slung between components, it is **printed underneath
 * them** — a footprint with pads where the part is seated, and traces leaving
 * it. Drawing that says the same thing about the machine and says it in the
 * language of the object rather than over the top of it.
 *
 * It also does something the cables could not: the footprints stay visible
 * around the edge of every part, so each one is visibly *seated in a place made
 * for it* rather than set down on a plate.
 */
const TRACE_Y = DECK + 0.002;

/** One part's footprint: an outline on the surface with pads at its corners. */
function Footprint({
  cx,
  cz,
  w,
  d,
}: {
  cx: number;
  cz: number;
  w: number;
  d: number;
}) {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const z0 = cz - d / 2;
  const z1 = cz + d / 2;
  const pad = 0.07;

  return (
    <>
      <polygon
        points={facePoints([
          [x0, TRACE_Y, z0],
          [x1, TRACE_Y, z0],
          [x1, TRACE_Y, z1],
          [x0, TRACE_Y, z1],
        ])}
        fill={EDGE}
        fillOpacity={0.06}
        stroke={EDGE}
        strokeOpacity={0.42}
        strokeWidth={1}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Solder pads at the corners. Small, and the only reason they are here
          is that an outline on its own reads as a shadow; four pads make it a
          footprint. */}
      {[
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ].map(([x, z]) => (
        <polygon
          key={`${x},${z}`}
          points={facePoints([
            [x - pad / 2, TRACE_Y, z - pad / 2],
            [x + pad / 2, TRACE_Y, z - pad / 2],
            [x + pad / 2, TRACE_Y, z + pad / 2],
            [x - pad / 2, TRACE_Y, z + pad / 2],
          ])}
          fill={EDGE}
          fillOpacity={0.5}
          stroke="none"
        />
      ))}
    </>
  );
}

/**
 * A trace run, routed the way a trace is actually routed: along an axis, one
 * corner, along the other. A straight diagonal between two pads is the one
 * thing that would give this away as a drawing of a board rather than a board.
 */
function traceRun(
  from: [number, number],
  to: [number, number],
  zFirst: boolean,
  /**
   * Offset for a parallel copy, in board units.
   *
   * ── Which way "parallel" is ─────────────────────────────────────────────
   *
   * This has to be applied per *leg*, and getting it wrong is what made the
   * first version of the circuitry look like a wall standing on the board
   * instead of a pattern printed on it.
   *
   * The mistake was to offset the whole route by `(d, d)` — the same amount in
   * `x` and in `z`. In this projection that displacement is invisible
   * horizontally and purely downward vertically, because screen x depends on
   * `x − z` (unchanged) and screen y on `x + z` (increased). So four "parallel"
   * traces came out as one trace repeated straight down the screen, which the
   * eye reads as a single extruded ribbon standing up off the surface. The
   * exact opposite of a flat marking.
   *
   * A leg running along `z` is offset in `x`; a leg running along `x` is offset
   * in `z`. Each leg then moves perpendicular to itself *within the plane of
   * the board*, which is what parallel means on a flat face, and the bundle
   * stays lying down.
   */
  offset = 0,
): { d: string; ends: [[number, number], [number, number]] } {
  const [x0, z0] = from;
  const [x1, z1] = to;

  /*
    The run reports where it ends, and that is not a convenience.

    Every endpoint has to carry a via, because a trace that stops in open board
    is a wire soldered at one end — the one thing that would say nobody looked
    at this. And the endpoints cannot be assumed to be `from` and `to`: each
    parallel copy is displaced per leg, so its own two ends sit at offsets that
    only this function knows. Returning them is what lets the caller terminate
    every single run rather than only the one it started from.
  */
  /*
    Rounded, because the endpoints are keys as well as positions. Adding an
    offset to an already-snapped coordinate reintroduces binary noise —
    `-1.3 + 0.09` is `-1.2100000000000002` — and two ends that ought to be the
    same point then differ in the last bit, so the deduplication silently stops
    deduplicating and the same via is drawn twice with two different keys.
  */
  const r = (v: number) => Math.round(v * 1000) / 1000;
  const a: [number, number] = zFirst
    ? [r(x0 + offset), r(z0)]
    : [r(x0), r(z0 + offset)];
  const b: [number, number] = zFirst
    ? [r(x1), r(z1 + offset)]
    : [r(x1 + offset), r(z1)];
  const corner: [number, number] = zFirst ? [a[0], b[1]] : [b[0], a[1]];

  const p = (q: [number, number]): Point => [q[0], TRACE_Y, q[1]];
  return {
    d: `${line(p(a), p(corner))} ${line(p(corner), p(b))}`,
    ends: [a, b],
  };
}

/**
 * A tiny deterministic generator, so the board is the same board every render.
 *
 * The circuitry below is generated rather than authored — there is too much of
 * it to draw by hand and no reason for any one route to be a particular route.
 * But it must not be *random*: this component is rendered on the server for the
 * stacked fallback and again on the client, and a board that differs between
 * the two is a hydration mismatch. A fixed seed makes it fixed art that merely
 * happens to have been computed.
 */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The rest of the board: the circuitry that is not going anywhere in
 * particular.
 *
 * A board with routes only where the five parts are does not read as a board,
 * it reads as five footprints on a plate. What makes a PCB recognisable at a
 * glance is the *field* — dense parallel runs, right-angle turns, vias, a lot
 * of it going somewhere the viewer is not being asked to follow.
 *
 * Three rules keep it from turning into noise. Everything is snapped to a 0.1
 * grid, because real routing is on a grid and the eye knows it even when it
 * cannot say why. Every run is axis-aligned with a single corner, so the whole
 * field lies along the projection's own two directions and reads as pattern
 * rather than as scribble. And there is *less of it than you would expect*:
 * density is what turns a flat marking into a texture that looks like it is
 * standing up, so the bundles are small, spaced, and far apart.
 */
const CIRCUIT = (() => {
  const rand = seeded(0x5eed_1a7c);
  const edge = BOARD - 0.22;
  /*
    Snapped to a tenth *and normalised*, because `Math.round(v / 0.1) * 0.1` is
    only approximately a tenth: it produces values like -0.30000000000000004,
    and those leak straight into anything built from the coordinate. Rounding
    through two decimals is what makes two points that ought to be the same
    point actually equal.
  */
  const snap = (v: number) => Math.round(v * 10) / 10;
  const pick = (lo: number, hi: number) => snap(lo + rand() * (hi - lo));

  const runs: string[] = [];
  /*
    A set, not a list. The generator picks endpoints at random on a coarse grid,
    so it lands on the same point twice often enough to matter — which drew the
    same via twice and, because the coordinate was also the React key, produced
    a duplicate-key warning. Deduplicating fixes both at once, and it is the
    right fix rather than a unique key would be: two vias in one hole is not
    something to render carefully, it is something that should not exist.
  */
  const vias = new Map<string, [number, number]>();
  const via = (p: [number, number]) => vias.set(`${p[0]},${p[1]}`, p);

  /* Every run terminates at both ends, whichever kind of run it is. */
  const route = (
    from: [number, number],
    to: [number, number],
    zFirst: boolean,
    offset = 0,
  ) => {
    const { d, ends } = traceRun(from, to, zFirst, offset);
    runs.push(d);
    via(ends[0]);
    via(ends[1]);
  };

  /* Bundles: two or three traces turning the same corner in step. */
  for (let b = 0; b < 5; b++) {
    const zFirst = rand() > 0.5;
    const from: [number, number] = [pick(-edge, edge), pick(-edge, edge)];
    const to: [number, number] = [pick(-edge, edge), pick(-edge, edge)];
    const count = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < count; i++) route(from, to, zFirst, i * 0.09);
  }

  /* Singles, to break up the regularity the bundles create. */
  for (let s = 0; s < 9; s++) {
    const from: [number, number] = [pick(-edge, edge), pick(-edge, edge)];
    const to: [number, number] = [pick(-edge, edge), pick(-edge, edge)];
    route(from, to, rand() > 0.5);
  }

  return { runs: runs.join(' '), vias: [...vias.values()] };
})();

/**
 * The board itself. Not one of the five, and not decoration either: it is the
 * thing that makes the other five one machine instead of five objects, and it
 * is the surface every one of them is standing on.
 */
function Deck() {
  /* Every footprint routed back to the socket in the middle, in bundles of two
     so a run reads as a bus rather than as a single wire. These terminate the
     same way the field does: a pad at each end, taken from the run itself,
     since the offset copy does not end where its base does. */
  const signal = [
    traceRun([-1.14, -0.3], [-0.86, -0.3], false, 0),
    traceRun([-1.14, -0.3], [-0.86, -0.3], false, 0.1),
    traceRun([1.04, -0.6], [0.36, -0.2], true, 0),
    traceRun([1.04, -0.6], [0.36, -0.2], true, 0.1),
    traceRun([0.8, -0.95], [0.1, -0.58], true, 0),
    traceRun([0.8, -0.95], [0.1, -0.58], true, 0.1),
    traceRun([-0.5, 0.92], [-0.5, 0.68], false, 0),
    traceRun([-0.2, 0.92], [-0.2, 0.68], false, 0),
  ];
  const runs = signal.map((s) => s.d).join(' ');
  const signalPads = [
    ...new Map(
      signal.flatMap((s) => s.ends).map((e) => [`${e[0]},${e[1]}`, e]),
    ).values(),
  ];

  return (
    <>
      <Box
        cx={0}
        cz={0}
        w={BOARD * 2}
        d={BOARD * 2}
        h={DECK}
        fill={BOARD_FILL}
        stroke={EDGE}
      />

      {/* The field first and quietly: it is texture, and it has to sit far
          enough back that the runs into the five footprints still read as the
          ones that mean something. */}
      <path
        d={CIRCUIT.runs}
        fill="none"
        stroke={EDGE}
        strokeOpacity={0.2}
        strokeWidth={0.9}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {CIRCUIT.vias.map(([vx, vz]) => (
        <ellipse
          key={`${vx},${vz}`}
          cx={sx(vx, vz)}
          cy={sy(vx, TRACE_Y, vz)}
          rx={0.035 * ELL_RX}
          ry={0.035 * ELL_RY}
          fill={EDGE}
          fillOpacity={0.3}
        />
      ))}

      {/* Then the runs that go somewhere, brighter and heavier, and terminated
          at both ends like everything else on the board. */}
      {signalPads.map(([vx, vz]) => (
        <ellipse
          key={`${vx},${vz}`}
          cx={sx(vx, vz)}
          cy={sy(vx, TRACE_Y, vz)}
          rx={0.045 * ELL_RX}
          ry={0.045 * ELL_RY}
          fill={EDGE}
          fillOpacity={0.55}
        />
      ))}
      <path
        d={runs}
        fill="none"
        stroke={EDGE}
        strokeOpacity={0.45}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Slightly larger than the part that sits on each, so the outline shows
          around it. A footprint the exact size of its component is a footprint
          nobody will ever see. */}
      <Footprint cx={-1.35} cz={-0.35} w={0.56} d={1.22} />
      <Footprint cx={0.795} cz={-0.62} w={1.0} d={1.18} />
      <Footprint cx={1.05} cz={-1.28} w={1.37} d={0.84} />
      <Footprint cx={-0.25} cz={0.05} w={1.24} d={1.24} />
      <Footprint cx={-0.55} cz={1.28} w={1.98} d={0.72} />
    </>
  );
}

/** The I/O panel: where events arrive, bolted to the back edge of the board. */
function AdmissionForm({ lit }: { lit: boolean }) {
  const fill = lit ? 'var(--primary)' : METAL;
  const stroke = lit ? 'var(--primary)' : EDGE;
  return (
    <>
      <Box
        cx={-1.35}
        cz={-0.35}
        w={0.34}
        d={1.0}
        y={DECK}
        h={0.44}
        fill={fill}
        stroke={stroke}
      />
      {/* Three connector shrouds standing proud of the panel, which is what a
          port block looks like from behind and what says "this face is the
          outside of the machine". */}
      {[-0.66, -0.35, -0.04].map((cz) => (
        <Box
          key={cz}
          cx={-1.35}
          cz={cz}
          w={0.2}
          d={0.16}
          y={DECK + 0.44}
          h={0.09}
          fill={fill}
          stroke={stroke}
        />
      ))}
    </>
  );
}

/** Memory: four thin cards standing edge-on in a row of slots. */
function DecoderForm({ lit }: { lit: boolean }) {
  const fill = lit ? 'var(--primary)' : METAL;
  const stroke = lit ? 'var(--primary)' : EDGE;
  return (
    <>
      {[0.45, 0.68, 0.91, 1.14].map((cx) => (
        <g key={cx}>
          {/* The slot the card is seated in. Without it the cards look stuck
              to the board rather than plugged into it. */}
          <Box
            cx={cx}
            cz={-0.62}
            w={0.15}
            d={1.0}
            y={DECK}
            h={0.06}
            fill={lit ? 'var(--primary)' : BOARD_FILL}
            stroke={stroke}
          />
          <Box
            cx={cx}
            cz={-0.62}
            w={0.075}
            d={0.92}
            y={DECK + 0.06}
            h={0.52}
            fill={fill}
            stroke={stroke}
          />
        </g>
      ))}
    </>
  );
}

/** The drive: a squat slab bolted into the back corner. */
function SpoolForm({ lit }: { lit: boolean }) {
  const fill = lit ? 'var(--primary)' : METAL;
  const stroke = lit ? 'var(--primary)' : EDGE;
  return (
    <>
      <Box
        cx={1.05}
        cz={-1.28}
        w={1.15}
        d={0.62}
        y={DECK}
        h={0.4}
        fill={fill}
        stroke={stroke}
      />
      {/* A lid inset on top, so the slab reads as an enclosure with something
          in it rather than as a solid billet. */}
      <Box
        cx={1.05}
        cz={-1.28}
        w={0.9}
        d={0.4}
        y={DECK + 0.4}
        h={0.04}
        fill={lit ? 'var(--primary)' : BOARD_FILL}
        stroke={stroke}
      />
    </>
  );
}

/** The cooler: the heaviest thing on the board, over the part that does the work. */
function WorkersForm({ lit }: { lit: boolean }) {
  const fill = lit ? 'var(--primary)' : METAL;
  const stroke = lit ? 'var(--primary)' : EDGE;
  const cx = -0.25;
  const cz = 0.05;
  return (
    <>
      {/* Socket, then base, then the fin stack, then the fan. Four courses that
          each sit on the one below: the assembly is a stack, and a stack is the
          cheapest way to say "bolted down" in an isometric drawing. */}
      <Box
        cx={cx}
        cz={cz}
        w={1.02}
        d={1.02}
        y={DECK}
        h={0.07}
        fill={lit ? 'var(--primary)' : BOARD_FILL}
        stroke={stroke}
      />
      <Box
        cx={cx}
        cz={cz}
        w={0.84}
        d={0.84}
        y={DECK + 0.07}
        h={0.12}
        fill={fill}
        stroke={stroke}
      />
      {[-0.3, -0.15, 0, 0.15, 0.3].map((u) => (
        <Box
          key={u}
          cx={cx + u}
          cz={cz}
          w={0.07}
          d={0.8}
          y={DECK + 0.19}
          h={0.42}
          fill={fill}
          stroke={stroke}
        />
      ))}
      <Box
        cx={cx}
        cz={cz}
        w={0.84}
        d={0.84}
        y={DECK + 0.61}
        h={0.05}
        fill={fill}
        stroke={stroke}
      />
      <Disc cx={cx} cz={cz} y={DECK + 0.67} r={0.36} lit={lit} />
      <Disc
        cx={cx}
        cz={cz}
        y={DECK + 0.675}
        r={0.12}
        lit={lit}
        filled={false}
      />
    </>
  );
}

/**
 * The expansion card, drawn as a card and not as a plate.
 *
 * It was a bare rectangle standing edge-on with two little posts under it,
 * which is the shape of a graphics card and none of the detail — at a glance it
 * read as a wall, or as a piece of the box that had come loose.
 *
 * A card is four things stacked front to back, and drawing them in that order
 * is what makes it legible: the bare PCB standing in its slot, the cooler
 * shroud hung on the near face of it, the fans set into the top of the shroud,
 * and the I/O bracket closing the near end. The shroud is the piece that does
 * the work — it is what turns a flat plate into an object with a front and a
 * back, and it is why the fans have somewhere to be.
 *
 * The fans sit on the shroud's *top* face, which is horizontal, so they are
 * ordinary flat discs in this projection. On the near face they would be
 * circles in a vertical plane, which is a different ellipse at a different
 * angle for no gain in what the drawing says.
 */
function FoldForm({ lit }: { lit: boolean }) {
  const fill = lit ? 'var(--primary)' : METAL;
  const stroke = lit ? 'var(--primary)' : EDGE;
  const cz = 1.16;
  const shroudZ = 1.44;
  const shroudTop = DECK + 0.58;

  return (
    <>
      {/* The slot, then the board seated in it. */}
      <Box
        cx={-0.55}
        cz={cz}
        w={1.7}
        d={0.16}
        y={DECK}
        h={0.07}
        fill={lit ? 'var(--primary)' : BOARD_FILL}
        stroke={stroke}
      />
      <Box
        cx={-0.55}
        cz={cz}
        w={1.8}
        d={0.07}
        y={DECK + 0.07}
        h={0.78}
        fill={fill}
        stroke={stroke}
      />

      {/* The shroud, hung on the near face and stopping short of the board's
          far end — a cooler that runs the full length of the card leaves no
          PCB showing, and the strip of bare board is most of what identifies
          the thing as a card. */}
      <Box
        cx={-0.62}
        cz={shroudZ}
        w={1.5}
        d={0.42}
        y={DECK + 0.12}
        h={0.46}
        fill={fill}
        stroke={stroke}
      />

      {/* Two fans, each a rim and a hub. The hub is unfilled so the rim does
          not read as a solid disc — a fan is mostly a hole. */}
      {[-1.02, -0.24].map((fanX) => (
        <g key={fanX}>
          <Disc cx={fanX} cz={shroudZ} y={shroudTop} r={0.19} lit={lit} />
          <Disc
            cx={fanX}
            cz={shroudZ}
            y={shroudTop + 0.002}
            r={0.07}
            lit={lit}
            filled={false}
          />
        </g>
      ))}

      {/* The I/O bracket, across the near end and standing proud of the card:
          the one feature that says which end of this plugs into the outside. */}
      <Box
        cx={0.36}
        cz={1.3}
        w={0.08}
        d={0.62}
        y={DECK}
        h={0.92}
        fill={fill}
        stroke={stroke}
      />
    </>
  );
}

/**
 * `anchor` is where the leader line leaves the part. It is authored per part
 * rather than derived from a bounding box because the point that reads as "this
 * one" is a specific corner of a specific feature — the top of the tallest fin,
 * the outer end of the card — and a bounding box would pick the arithmetic
 * centre of a shape that may be mostly empty air.
 *
 * `depth` is `x + z` at the part's centre, which is exactly how far from the eye
 * it is in this projection, and it is what the draw order is sorted on.
 */
export const PARTS = [
  {
    key: 'admission',
    label: 'Admission control',
    note: 'quota · 429',
    Form: AdmissionForm,
    anchor: [-1.35, DECK + 0.53, -0.04] as Point,
    depth: -1.7,
  },
  {
    key: 'decoder',
    label: 'Envelope decoder',
    note: 'gzip · 8 item kinds',
    Form: DecoderForm,
    anchor: [1.14, DECK + 0.58, -0.16] as Point,
    depth: 0.18,
  },
  {
    key: 'spool',
    label: 'Durable spool',
    note: 'disk · 200 OK',
    Form: SpoolForm,
    anchor: [1.62, DECK + 0.4, -0.97] as Point,
    depth: -0.23,
  },
  {
    key: 'workers',
    label: 'Digest workers',
    note: 'tokio · in-process',
    Form: WorkersForm,
    anchor: [0.11, DECK + 0.67, 0.05] as Point,
    depth: -0.2,
  },
  {
    key: 'fold',
    label: 'Fingerprint',
    note: 'sha-256 · one row',
    Form: FoldForm,
    anchor: [0.35, DECK + 0.69, 1.24] as Point,
    depth: 0.65,
  },
] as const;

/**
 * The order the parts are painted in: furthest from the eye first.
 *
 * There is no depth buffer in an SVG, only document order, so this is the whole
 * of the hidden-surface handling. It has to be derived from `depth` rather than
 * from the claim order, because those two are now deliberately different — the
 * reading order runs admission, decoder, spool, workers, card, and the painting
 * order runs admission, spool, workers, decoder, card.
 */
const DRAW_ORDER = PARTS.map((part, index) => ({ part, index }))
  .slice()
  .sort((a, b) => a.part.depth - b.part.depth);

/* -------------------------------------------------------------------------- */
/* One component                                                               */
/* -------------------------------------------------------------------------- */

const LEADER_FROM = sx(R, -R) + 6;
const LEADER_TO = LEADER_FROM + 28;
const LABEL_X = LEADER_TO + 9;

/** Where each label sits, stacked down the right-hand gutter. */
const LABEL_TOP = 92;
const LABEL_STEP = 48;

/**
 * Type sizes in the gutter, in viewBox units rather than pixels.
 *
 * The drawing is now scaled to fill its container, which means the text scales
 * with it: measured across the desktop range the SVG renders at between 1.5 and
 * 1.85 times its viewBox, so 7 and 5.5 land at roughly 11 and 9px on screen. At
 * the 11.5 they used to be they would have come out over 20px — larger than the
 * body copy in the panel beside them.
 */
const LABEL_SIZE = 9;
const NOTE_SIZE = 7;

/**
 * The frame, sized to the drawing at its largest: fully open, fully labelled,
 * plus 30 units of margin on every side.
 *
 * The margin used to be 16, chosen to squeeze the drawing as large as it would
 * go, and that was the wrong thing to optimise. A frame fitted to the content
 * with nothing to spare has no tolerance for the parts of this drawing that are
 * hard to bound exactly — the width of a rendered text run is an estimate, and
 * the stroke on an outlined polygon sits astride its own path. Thirty units
 * costs a few percent of scale and removes a whole class of "it clips at some
 * widths" from the section.
 */
const VIEW_W = 588;
const VIEW_H = 430;

/**
 * The same drawing with the label gutter taken away, for a portrait frame.
 *
 * A phone cannot have the gutter. The type in it is authored in viewBox units,
 * so it scales with the drawing — at 9 units it lands near 11px across the
 * desktop range and near 5px at 390 wide, which is not small type, it is a grey
 * smear. And it is the gutter that makes the frame 1.37 wide in the first
 * place: two fifths of the width is reserved for text nobody on a phone can
 * read, and the cube is paying for it.
 *
 * So on a portrait stage the names move into the reading panel, where they are
 * set in real pixels, and the frame closes down to the machine itself. These
 * numbers are the drawing's own extent at full extension — the raised lid at
 * the top, the two near walls at the ends of their shortened travel, the ground
 * lattice under it — plus about 14 units of margin.
 *
 * The result is very nearly square, which is what lets the portrait stage give
 * it a tall slot without wasting either dimension, and the cube comes out about
 * half again as large on the same 390px screen as it was inside the landscape
 * frame. Squaring it up is also why the walls travel less here — see
 * `WALL_OUT_TALL`, which these numbers are derived from, and which has to move
 * with them.
 */
const TALL_X = 94;
const TALL_Y = 12;
const TALL_W = 400;
const TALL_H = 392;

/**
 * ── There is no re-framing animation, and there must not be ─────────────────
 *
 * One frame, fixed, for every moment of the section. The only things that move
 * are the parts of the machine.
 *
 * A version of this scaled and slid the whole drawing to fit the shut cube more
 * tightly, on the reasoning that the frame reserves width for the label gutter
 * and height for the lid's travel, and both sit empty while the box is closed.
 * The reasoning was right and the remedy was wrong, twice:
 *
 * Tied to the label clock, it clipped. The labels do not start until the box
 * has finished opening, so for that whole act the drawing was at full extent
 * inside a frame still zoomed in for a closed cube — the lid sat 32px above the
 * top of the viewBox and was cut off.
 *
 * Tied to the opening, it clipped nothing and broke the animation instead. It
 * became a second movement running underneath the first: the lid rose while the
 * frame slid everything downward, so the box appeared to sink as it opened and
 * to lurch back up as it shut. Two motions competing over the same pixels do
 * not read as one considered gesture, they read as a bug.
 *
 * The frame is instead made *symmetric*: `OX` is exactly `VIEW_W / 2`, with the
 * label gutter on the right balanced by empty margin on the left. The cube is
 * therefore centred at every moment of the section without anything having to
 * animate to keep it there — which was the whole point of the exercise. Closed,
 * the drawing sits 4px off the frame's vertical centre, under one percent, and
 * that is what "close enough" looks like.
 *
 * The empty left margin costs nothing. The drawing letterboxes into a container
 * far wider than its own 1.29 aspect, so it is height-constrained at every
 * desktop size — the spare width was never going to become scale.
 */

function Component({
  index,
  active,
  ghosted,
  open,
  label,
  named,
}: {
  index: number;
  active: boolean;
  /** Some other part is the subject, so this one gets out of the way. */
  ghosted: boolean;
  open: MotionValue<number>;
  label: MotionValue<number>;
  /** Whether this part draws its leader out to the gutter. See `TALL_*`. */
  named: boolean;
}) {
  const part = PARTS[index];

  /*
    Components stand up once the walls are out of the way, one after another, so
    the interior is populated in the order an event travels through it rather
    than appearing all at once. Each window closes well before 1: with five of
    them a step of 0.07 or more runs the last one past the end of the scrub, and
    since `useTransform` clamps its input, the final component would simply
    never finish arriving.
  */
  const stand = useTransform(
    open,
    [0.26 + index * 0.06, 0.5 + index * 0.06],
    [0, 1],
  );
  const rise = useTransform(stand, [0, 1], [14, 0]);

  /*
    The annotations run on their own clock, not on `open`.

    They are the second act. The box finishes opening and *then* the drawing
    gets labelled, at the same moment the reading panel arrives beside it — so
    the leaders and the panel are one gesture rather than two things that happen
    to overlap. Sharing `open` put every label on screen before the panel had
    started to move, which read as the drawing explaining itself and the panel
    turning up late to agree with it.
  */
  const annotation = useTransform(
    label,
    [index * 0.1, 0.5 + index * 0.1],
    [0, 1],
  );

  /*
    The leader leaves from a named point on the part rather than from a computed
    corner of it.

    It used to be derived: the rightmost corner of a block's top face, which
    worked while every part *was* a block of known size. The parts are now a
    port panel, a row of cards, a slab, a four-course stack and a long thin
    plate, and there is no single formula that picks a sensible point on all
    five. Each one names its own — see `anchor` in `PARTS`.
  */
  const anchorX = px(part.anchor);
  const anchorY = py(part.anchor);
  const labelY = LABEL_TOP + index * LABEL_STEP;

  /*
    Ghosting.

    Everything that is not the subject of the current claim drops away, and this
    is the only reason the parts can be arranged for depth rather than for
    visibility: the expansion card stands in front of the cooler and the cooler
    stands in front of the drive, so at least one part is always behind another
    one. Dimming the rest is what lets the reader see through to whichever is
    being talked about.

    It is deliberately the same gesture the box makes when its near walls fade
    on the way out, rather than a second, different one. A drawing that has one
    way of saying "this is in the way" is a drawing; one that has two is a pile
    of effects.

    Held at full strength while no claim is being read (`active` is -1 between
    acts, and `ghosted` is false for every part then), so the assembled machine
    is seen whole before it is taken apart.
  */
  return (
    <>
      <motion.g style={{ opacity: stand, y: rise }}>
        <g
          opacity={ghosted ? 0.42 : 1}
          style={{ transition: `opacity ${DUR.base}s` }}
        >
          <part.Form lit={active} />
        </g>
      </motion.g>

      {/* Leader out to the gutter, in the convention of the drawing: a hairline
          from the part, one elbow, then its name. Absent on a portrait frame,
          where the names are set in the reading panel instead. */}
      {named ? (
        <motion.g style={{ opacity: annotation }}>
          <path
            d={`M${anchorX} ${anchorY} L${LEADER_FROM} ${labelY + 6} L${LEADER_TO} ${labelY + 6}`}
            fill="none"
            stroke={active ? 'var(--primary)' : 'var(--rule)'}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            style={{ transition: `stroke ${DUR.base}s` }}
          />
          <text
            x={LABEL_X}
            y={labelY + 3}
            fill={active ? 'var(--foreground)' : 'var(--muted-foreground)'}
            fontSize={LABEL_SIZE}
            fontWeight={500}
            style={{ transition: `fill ${DUR.base}s` }}
          >
            {part.label}
          </text>
          <text
            x={LABEL_X}
            y={labelY + 15}
            fill="var(--muted-foreground)"
            fontFamily="var(--font-geist-mono), monospace"
            fontSize={NOTE_SIZE}
            opacity={active ? 0.9 : 0.42}
            style={{ transition: `opacity ${DUR.base}s` }}
          >
            {part.note}
          </text>
        </motion.g>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* The scene                                                                   */
/* -------------------------------------------------------------------------- */

export function EngineScene({
  active,
  open,
  label,
  named = true,
  className = 'h-auto w-full',
}: {
  active: number;
  /** Lifts the lid, swings the walls out and stands the components up. */
  open: MotionValue<number>;
  /** Draws the leader lines and their names, once the box is open. */
  label: MotionValue<number>;
  /**
   * Whether the drawing labels itself.
   *
   * On a landscape stage it does: five leaders out to a gutter, which is the
   * convention the whole drawing is in. On a portrait one it cannot — the type
   * would come out at about 5px — so the gutter goes, the frame closes down to
   * the machine, and the names are set in the panel instead. See `TALL_*`.
   */
  named?: boolean;
  /**
   * How the drawing sizes itself.
   *
   * The pinned stage passes `h-full w-full` so the SVG fills the held frame and
   * letterboxes inside it, which is what finally made the drawing as large as
   * the space allows. The default sizes by width instead, for the stacked
   * fallback, where the container has no height of its own to fill.
   */
  className?: string;
}) {
  const reduced = useReducedMotion();

  /*
    Under reduced motion the box is simply open. The opening is the one thing
    here that is load-bearing rather than decorative — shut, the drawing shows
    none of the five components the claims are naming — so it cannot be dropped,
    only finished in advance.
  */
  const held = useTransform(open, () => 1);
  const heldLabel = useTransform(label, () => 1);
  const drive = reduced ? held : open;
  const naming = reduced ? heldLabel : label;

  /* The lid lifts straight up and hangs there, so the mark on it stays readable
     the whole time. A lid that flies off takes the product's name with it. */
  const lidY = useTransform(drive, [0, 0.34], [0, -LID_RISE * U]);

  /*
    The two near walls travel outward along their own axes. `x` and `y` are
    given separately because an isometric translation is two screen components:
    moving `WALL_OUT` along +x is `(+cos30, +sin30) · WALL_OUT · U` on screen,
    and along +z it is `(−cos30, +sin30) · WALL_OUT · U`.

    Shorter on a portrait frame, which is what lets that frame be square. See
    `WALL_OUT_TALL`.
  */
  const travel = named ? WALL_OUT : WALL_OUT_TALL;
  const outX = travel * COS30 * U;
  const outY = travel * SIN30 * U;
  const rightX = useTransform(drive, [0, 0.34], [0, outX]);
  const rightY = useTransform(drive, [0, 0.34], [0, outY]);
  const leftX = useTransform(drive, [0, 0.34], [0, -outX]);
  const leftY = useTransform(drive, [0, 0.34], [0, outY]);
  const wallFade = useTransform(drive, [0.06, 0.34], [1, 0.45]);

  /* The sealed flank: a vent and a status light, and the only thing that says
     "this is one closed appliance" before it comes apart. Gone before the
     interior appears, or the drawing is briefly both. */
  const shut = useTransform(drive, [0, 0.2], [1, 0]);
  const interior = useTransform(drive, [0.12, 0.4], [0, 1]);

  const louvres = Array.from({ length: 5 }, (_, i) => {
    const h = 0.34 + i * 0.3;
    return line([R, h, -R + 0.7], [R, h, R - 0.7]);
  }).join(' ');

  /** The ground lattice, as one path. */
  const grid: string[] = [];
  for (let i = -GROUND; i <= GROUND + 1e-6; i += CELL) {
    grid.push(line([i, 0, -GROUND], [i, 0, GROUND]));
    grid.push(line([-GROUND, 0, i], [GROUND, 0, i]));
  }

  return (
    <svg
      viewBox={
        named
          ? `0 0 ${VIEW_W} ${VIEW_H}`
          : `${TALL_X} ${TALL_Y} ${TALL_W} ${TALL_H}`
      }
      className={className}
      role="img"
      aria-label="An isometric drawing of the Rustrak server as a single cube standing on a grid. It opens: the lid lifts and the two near walls swing away, revealing the five components inside — admission control, the envelope decoder, the durable spool, the digest workers and the fingerprint."
    >
      <title>The server, opened up</title>

      <defs>
        {/* The lattice has to stop without having an edge. A hard rectangle of
            grid reads as a texture swatch someone pasted behind the object;
            faded out radially it reads as ground continuing past the frame. */}
        <radialGradient id="engine-ground" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="engine-ground-mask">
          <rect
            x={sx(0, 0) - GROUND_RX}
            y={sy(0, 0, 0) - GROUND_RY}
            width={GROUND_RX * 2}
            height={GROUND_RY * 2}
            fill="url(#engine-ground)"
          />
        </mask>
        <radialGradient id="engine-contact" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Everything the drawing is made of rides one group, so the recentring
          slide moves the ground, the box, the components and their labels as a
          single object. */}
      <g>
        {/* ── The environment ────────────────────────────────────────────── */}
        <g mask="url(#engine-ground-mask)">
          <path
            d={grid.join(' ')}
            stroke="var(--rule)"
            strokeWidth={1}
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        </g>

        <ellipse
          cx={sx(0, 0)}
          cy={sy(0, 0, 0) + 3}
          rx={R * COS30 * U * 1.5}
          ry={R * SIN30 * U * 1.15}
          fill="url(#engine-contact)"
        />

        {/* ── The interior, revealed as the walls come away ─────────────────────
          The floor and the two far walls, seen from the inside. They are the
          surfaces the box was hiding, so they only exist once it is opening. */}
        <motion.g style={{ opacity: interior }}>
          <polygon
            points={facePoints([
              [-R, 0, -R],
              [R, 0, -R],
              [R, 0, R],
              [-R, 0, R],
            ])}
            fill="var(--card)"
            stroke="var(--border)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <polygon
            points={facePoints([
              [-R, 0, -R],
              [R, 0, -R],
              [R, H, -R],
              [-R, H, -R],
            ])}
            fill="var(--card)"
            fillOpacity={0.72}
            stroke="var(--border)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <polygon
            points={facePoints([
              [-R, 0, -R],
              [-R, 0, R],
              [-R, H, R],
              [-R, H, -R],
            ])}
            fill="var(--card)"
            fillOpacity={0.55}
            stroke="var(--border)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </motion.g>

        {/* ── What is inside ─────────────────────────────────────────────────
          The board first, because everything else is bolted to it and it has to
          be there to be bolted to — it arrives with the interior surfaces
          rather than on any part's clock.

          Then the parts, furthest from the eye first. `DRAW_ORDER` is sorted on
          `depth`, not on the claim order, and the two are deliberately
          different: an SVG has no depth buffer, so document order is the whole
          of the hidden-surface handling, while the labels down the gutter still
          have to run in the order an event meets the parts. */}
        <motion.g style={{ opacity: interior }}>
          <Deck />
        </motion.g>

        {DRAW_ORDER.map(({ part, index }) => (
          <Component
            key={part.key}
            index={index}
            active={index === active}
            ghosted={active >= 0 && index !== active}
            open={drive}
            label={naming}
            named={named}
          />
        ))}

        {/* ── The two near walls ───────────────────────────────────────────────
          Drawn after the interior because when the box is shut they are in
          front of it, and they have to stay in front the whole way out. */}
        <motion.g style={{ x: leftX, y: leftY, opacity: wallFade }}>
          <polygon
            points={facePoints([
              [-R, H, R],
              [R, H, R],
              [R, 0, R],
              [-R, 0, R],
            ])}
            fill="var(--secondary)"
            fillOpacity={LEFT}
            stroke="var(--border)"
            strokeWidth={1}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </motion.g>

        <motion.g style={{ x: rightX, y: rightY, opacity: wallFade }}>
          <polygon
            points={facePoints([
              [R, H, R],
              [R, H, -R],
              [R, 0, -R],
              [R, 0, R],
            ])}
            fill="var(--secondary)"
            fillOpacity={RIGHT}
            stroke="var(--border)"
            strokeWidth={1}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {/* The vent and the status light ride the wall they are cut into. */}
          <motion.g style={{ opacity: shut }}>
            <path
              d={louvres}
              stroke="var(--foreground)"
              strokeOpacity={0.2}
              strokeWidth={1}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={sx(R, R - 0.42)}
              cy={sy(R, H - 0.34, R - 0.42)}
              r={2.6}
              fill="var(--primary)"
            />
          </motion.g>
        </motion.g>

        {/* ── The lid ──────────────────────────────────────────────────────────
          Last, so it passes over everything as it lifts, and carrying the one
          piece of branding in the drawing. */}
        <motion.g style={{ y: lidY }}>
          <polygon
            points={facePoints([
              [-R, H, -R],
              [R, H, -R],
              [R, H, R],
              [-R, H, R],
            ])}
            fill="var(--secondary)"
            fillOpacity={TOP}
            stroke="var(--border)"
            strokeWidth={1}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <g transform={planeAt(0, H, 0)}>
            <text
              x={0}
              y={0.1}
              textAnchor="middle"
              fill="var(--foreground)"
              fillOpacity={0.55}
              fontFamily="var(--font-geist-mono), monospace"
              fontSize={0.34}
              letterSpacing={0.08}
            >
              RUSTRAK
            </text>
          </g>
        </motion.g>
      </g>
    </svg>
  );
}
