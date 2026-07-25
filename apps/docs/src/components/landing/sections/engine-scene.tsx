'use client';

import {
  type MotionValue,
  motion,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import type { ReactNode } from 'react';
import { DUR } from '../motion';

/**
 * The server, as one cube that opens.
 *
 * ── What this is, and the three attempts it took ────────────────────────────
 *
 * A single solid standing on a ground plane. Scrolling lifts its lid and swings
 * its two near walls away, and inside are the five components the event
 * processor is built from, standing on the floor of the box in the order an
 * event meets them.
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
 * near walls swing out; then the components stand up one after another and their
 * leader lines draw. It is a scrub, so it runs backwards and the box closes.
 *
 * `active` is discrete and comes from which claim is being read. It only decides
 * which component is lit. A claim is either being made or it is not, so there is
 * nothing continuous to map it onto — tying the highlight to the scrub would
 * leave a component half-lit for most of its section, and tying the opening to
 * the claim index would unpack the box in five visible jerks.
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
 * Framed from the *open* state, never the shut one. Fully open the lid has
 * risen 1.5 units and the two walls have travelled 1.9 out along their own
 * axes, so a frame chosen while the cube was closed clips the lid and both
 * walls at exactly the moment the drawing finishes opening.
 */
const OX = 294;
const OY = 258;

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
/* The components inside                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Where each component stands on the floor of the box.
 *
 * All five sit on the line `z = −x`, which is the one axis of this projection
 * that is purely horizontal on screen: `sy` depends on `x + z`, so along that
 * line it never changes and the components read as a straight row, left to
 * right, in the order an event meets them. Any other arrangement makes the
 * sequence climb or descend and the reader has to work out the order instead of
 * being handed it.
 */
const SPREAD = 1.55;

/** Footprint and height of a component block. */
const BW = 0.72;

function Ink({ lit, children }: { lit: boolean; children: ReactNode }) {
  return (
    <g
      fill="none"
      stroke={lit ? 'var(--primary)' : 'var(--muted-foreground)'}
      strokeOpacity={lit ? 1 : 0.55}
      strokeWidth={1.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      style={{ transition: `stroke ${DUR.base}s, stroke-opacity ${DUR.base}s` }}
    >
      {children}
    </g>
  );
}

/** A gate: four requests through, one turned back. */
function AdmissionSymbol({ lit }: { lit: boolean }) {
  return (
    <Ink lit={lit}>
      <path d="M-0.26 -0.15 L0.26 -0.15 M-0.26 0 L0.26 0 M-0.26 0.15 L0.26 0.15" />
      <path d="M-0.26 0.3 L-0.02 0.3 M-0.12 0.22 l0.14 0.16 M0.02 0.22 l-0.14 0.16" />
      <path d="M-0.26 -0.3 L0.26 -0.3" />
    </Ink>
  );
}

/** One envelope fanning into typed items of different widths. */
function DecoderSymbol({ lit }: { lit: boolean }) {
  return (
    <Ink lit={lit}>
      <rect x={-0.3} y={-0.12} width={0.14} height={0.24} rx={0.03} />
      <path d="M-0.14 0 L0.02 0 M-0.14 0 C0 0, 0 -0.24, 0.06 -0.24 M-0.14 0 C0 0, 0 0.24, 0.06 0.24" />
      <path d="M0.06 -0.24 L0.3 -0.24 M0.02 0 L0.22 0 M0.06 0.24 L0.28 0.24" />
    </Ink>
  );
}

/** A buffer with its slots filling up behind a write head. */
function SpoolSymbol({ lit }: { lit: boolean }) {
  const slots = [-0.3, -0.15, 0, 0.15];
  return (
    <Ink lit={lit}>
      {slots.map((u, index) => (
        <rect
          key={u}
          x={u}
          y={-0.14}
          width={0.11}
          height={0.28}
          rx={0.03}
          fill={lit ? 'var(--primary)' : 'var(--muted-foreground)'}
          fillOpacity={index < 2 ? (lit ? 0.9 : 0.4) : 0}
        />
      ))}
      <path d="M0.02 -0.3 L0.02 -0.2" />
    </Ink>
  );
}

/** Parallel lanes, each with a task in flight at a different point. */
function WorkersSymbol({ lit }: { lit: boolean }) {
  const lanes = [
    { v: -0.2, at: -0.24, w: 0.2 },
    { v: 0, at: 0.02, w: 0.16 },
    { v: 0.2, at: -0.12, w: 0.26 },
  ];
  return (
    <Ink lit={lit}>
      {lanes.map((lane) => (
        <g key={lane.v}>
          <path d={`M-0.3 ${lane.v} L0.3 ${lane.v}`} strokeOpacity={0.35} />
          <rect
            x={lane.at}
            y={lane.v - 0.055}
            width={lane.w}
            height={0.11}
            rx={0.03}
            fill={lit ? 'var(--primary)' : 'var(--muted-foreground)'}
            fillOpacity={lit ? 0.85 : 0.4}
          />
        </g>
      ))}
    </Ink>
  );
}

/** Many events converging onto a single row. */
function FoldSymbol({ lit }: { lit: boolean }) {
  const sources = [-0.26, -0.09, 0.09, 0.26];
  return (
    <Ink lit={lit}>
      {sources.map((v) => (
        <path key={v} d={`M-0.3 ${v} C-0.05 ${v}, -0.02 0, 0.1 0`} />
      ))}
      <rect
        x={0.12}
        y={-0.09}
        width={0.2}
        height={0.18}
        rx={0.04}
        fill={lit ? 'var(--primary)' : 'var(--muted-foreground)'}
        fillOpacity={lit ? 0.95 : 0.45}
      />
    </Ink>
  );
}

export const PARTS = [
  {
    key: 'admission',
    label: 'Admission control',
    note: 'quota · 429',
    h: 0.5,
    Mark: AdmissionSymbol,
  },
  {
    key: 'decoder',
    label: 'Envelope decoder',
    note: 'gzip · 8 item kinds',
    h: 0.78,
    Mark: DecoderSymbol,
  },
  {
    key: 'spool',
    label: 'Durable spool',
    note: 'disk · 200 OK',
    h: 0.6,
    Mark: SpoolSymbol,
  },
  {
    key: 'workers',
    label: 'Digest workers',
    note: 'tokio · in-process',
    h: 0.92,
    Mark: WorkersSymbol,
  },
  {
    key: 'fold',
    label: 'Fingerprint',
    note: 'sha-256 · one row',
    h: 0.66,
    Mark: FoldSymbol,
  },
] as const;

const N = PARTS.length;

/** Position of component `i` along the screen-horizontal axis of the floor. */
const at = (index: number) => {
  const t = -SPREAD + (index * (SPREAD * 2)) / (N - 1);
  return { x: t, z: -t };
};

/* -------------------------------------------------------------------------- */
/* Solids                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The three faces of an extruded block a viewer can see, and only those three.
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

function Block({
  cx,
  cz,
  size,
  y = 0,
  h,
  fill,
  stroke,
}: {
  cx: number;
  cz: number;
  size: number;
  y?: number;
  h: number;
  fill: string;
  stroke: string;
}) {
  const a = -size / 2;
  const b = size / 2;
  const top = y + h;
  const faces: [Point[], number][] = [
    [
      [
        [cx + a, top, cz + a],
        [cx + b, top, cz + a],
        [cx + b, top, cz + b],
        [cx + a, top, cz + b],
      ],
      TOP,
    ],
    [
      [
        [cx + a, top, cz + b],
        [cx + b, top, cz + b],
        [cx + b, y, cz + b],
        [cx + a, y, cz + b],
      ],
      LEFT,
    ],
    [
      [
        [cx + b, top, cz + b],
        [cx + b, top, cz + a],
        [cx + b, y, cz + a],
        [cx + b, y, cz + b],
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
          fill={fill}
          fillOpacity={tone}
          stroke={stroke}
          strokeWidth={1}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* One component                                                               */
/* -------------------------------------------------------------------------- */

const LEADER_FROM = sx(R, -R) + 6;
const LEADER_TO = LEADER_FROM + 28;
const LABEL_X = LEADER_TO + 9;

/** Where each label sits, stacked down the right-hand gutter. */
const LABEL_TOP = 137;
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
const VIEW_H = 456;

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
  open,
  label,
}: {
  index: number;
  active: boolean;
  open: MotionValue<number>;
  label: MotionValue<number>;
}) {
  const part = PARTS[index];
  const { x, z } = at(index);
  const Mark = part.Mark;

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
    The leader leaves from the rightmost corner of the component's *top face*.

    It used to leave from the middle of that corner's vertical edge and carry a
    filled dot, and the dot was a mistake twice over: at `--rule` it is 9% white,
    so it read as a pale blob of no obvious origin floating on the block, and
    sitting halfway down an edge it touched neither the top face the reader is
    looking at nor the line it was supposed to terminate. A leader that begins
    exactly on a vertex needs no marker to say what it is attached to — the
    geometry says it.
  */
  const anchorX = sx(x + BW / 2, z - BW / 2);
  const anchorY = sy(x + BW / 2, part.h, z - BW / 2);
  const labelY = LABEL_TOP + index * LABEL_STEP;

  return (
    <>
      <motion.g style={{ opacity: stand, y: rise }}>
        <Block
          cx={x}
          cz={z}
          size={BW}
          h={part.h}
          fill={active ? 'var(--primary)' : 'var(--secondary)'}
          stroke={active ? 'var(--primary)' : 'var(--border)'}
        />
        {/* The mechanism, lying in the plane of this component's top face. */}
        <g transform={planeAt(x, part.h, z)}>
          <Mark lit={active} />
        </g>
      </motion.g>

      {/* Leader out to the gutter, in the convention of the drawing: a hairline
          from the part, one elbow, then its name. */}
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
  className = 'h-auto w-full',
}: {
  active: number;
  /** Lifts the lid, swings the walls out and stands the components up. */
  open: MotionValue<number>;
  /** Draws the leader lines and their names, once the box is open. */
  label: MotionValue<number>;
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
  */
  const outX = WALL_OUT * COS30 * U;
  const outY = WALL_OUT * SIN30 * U;
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
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
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

        {/* ── What is inside ───────────────────────────────────────────────── */}
        {PARTS.map((part, index) => (
          <Component
            key={part.key}
            index={index}
            active={index === active}
            open={drive}
            label={naming}
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
