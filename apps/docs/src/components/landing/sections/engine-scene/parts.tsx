'use client';
import { DECK } from './iso';
import { BOARD_FILL, Box, Disc, EDGE, METAL } from './solids';

/**
 * The five components of the event processor, as things bolted to a board.
 */

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

/** The I/O panel: where events arrive, bolted to the back edge of the board. */
export function AdmissionForm({ lit }: { lit: boolean }) {
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
export function DecoderForm({ lit }: { lit: boolean }) {
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
export function SpoolForm({ lit }: { lit: boolean }) {
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
export function WorkersForm({ lit }: { lit: boolean }) {
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
export function FoldForm({ lit }: { lit: boolean }) {
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
