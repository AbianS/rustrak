'use client';

import {
  type MotionValue,
  motion,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { DUR } from '../motion';
import { Deck } from './engine-scene/deck';
import {
  CELL,
  COS30,
  DECK,
  facePoints,
  GROUND,
  GROUND_RX,
  GROUND_RY,
  H,
  LID_RISE,
  line,
  type Point,
  planeAt,
  R,
  SIN30,
  sx,
  sy,
  U,
  WALL_OUT,
  WALL_OUT_TALL,
} from './engine-scene/iso';
import {
  AdmissionForm,
  DecoderForm,
  FoldForm,
  SpoolForm,
  WorkersForm,
} from './engine-scene/parts';
import { LEFT, px, py, RIGHT, TOP } from './engine-scene/solids';

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
