'use client';

import { BOARD, DECK, facePoints, line, type Point, sx, sy } from './iso';
import { BOARD_FILL, Box, EDGE, ELL_RX, ELL_RY } from './solids';

/**
 * The board the machine is mounted on: its surface, the etched circuit under
 * the parts, and the footprints they are bolted down through.
 */

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
export const TRACE_Y = DECK + 0.002;

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
export function traceRun(
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
export function seeded(seed: number) {
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
export const CIRCUIT = (() => {
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
export function Deck() {
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
