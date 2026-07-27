'use client';

import {
  type MotionValue,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import { type RefObject, useRef, useState } from 'react';
import { DUR, EASE } from '../motion';
import { Band, Cell } from '../primitives/grid';
import { Heading, Pill } from '../primitives/heading';
import { COMPACT, DESKTOP, useMediaQuery } from '../use-media-query';
import { EngineScene, PARTS } from './engine-scene';

/**
 * How the server stays small, told by opening it.
 *
 * ── The band is a stage, not a grid ─────────────────────────────────────────
 *
 * One viewport, pinned, with a long scroll track behind it. Everything that
 * happens in this section happens inside that single held frame:
 *
 *   1. The cube arrives shut and alone, using the whole width.
 *   2. It opens. The lid lifts, the near walls swing away, the components
 *      inside stand up one after another.
 *   3. The drawing slides left to make room, the leader lines draw, and the
 *      reading panel comes in from the right. They are one gesture.
 *   4. Five claims, one per component, the drawing lighting the part being
 *      described.
 *   5. The panel leaves, the leaders retract, and the box shuts again.
 *
 * ── Why it had to stop being a grid ─────────────────────────────────────────
 *
 * The previous version was a two-column layout with the drawing sticky in the
 * left cell and the claims scrolling in the right, and it had a bug that no
 * amount of tuning was going to fix: the reader always arrived to find the box
 * already open.
 *
 * The cause is worth writing down because it is the standard trap with
 * `useScroll` on a sibling. Progress was measured on the claims column with
 * `['start end', 'start center']` — from the column's top touching the bottom
 * of the viewport to it touching the middle. That whole range is spent *before*
 * the column has properly entered the screen, and the drawing beside it is
 * sticky, so by the time the drawing was centred and worth looking at, the
 * progress driving it had long since reached 1. The animation ran, correctly,
 * off screen.
 *
 * Measuring on a pinned track removes the class of bug rather than the
 * instance. The element being measured is the element being held, `start start`
 * to `end end` is exactly the distance it is held for, and there is no longer
 * any way for the two to disagree.
 *
 * ── Two stages, one sequence ────────────────────────────────────────────────
 *
 * The five acts are told twice, at two aspect ratios. `Stage` puts the panel
 * beside the drawing and lets the drawing label itself out to a gutter;
 * `PhoneStage` puts the panel under the drawing and moves the names into it,
 * because the gutter's type is authored in viewBox units and comes out at about
 * 5px on a phone.
 *
 * They share `useActs`, which owns the track, the two clocks and the claim
 * index. That is deliberate and it is the part to protect: the difference
 * between the two is meant to be geometry and nothing else, so any change to
 * the pacing lands on both or on neither.
 */

/**
 * The track, in screen heights.
 *
 * Five claims that each need to be read, plus an opening and a closing that are
 * the point of the section rather than transitions to be got through. Shorter
 * and the box snaps open; much longer and the reader is scrolling through a
 * held frame wondering whether the page has stopped working.
 */
const TRACK = '560svh';

/**
 * The same track on a phone, shorter.
 *
 * Not because a phone deserves less of the section — it gets all five claims —
 * but because a thumb covers more of a track per gesture than a wheel does, and
 * a held frame that outlasts the reader's patience is the one failure mode this
 * device has. The acts are the same fractions of a shorter distance, so each
 * claim still gets about a screen and a half of travel.
 */
const TRACK_PHONE = '480svh';

/**
 * Where each act begins and ends, as fractions of the track.
 *
 * Kept as one table because the acts have to abut exactly: a gap between two of
 * them is a stretch of scrolling where nothing at all changes, which on a
 * pinned section reads as the page having frozen.
 */
const ACT = {
  /** The box opens. Generous — this is the moment the section exists for. */
  open: [0.02, 0.22],
  /** The drawing shifts left, the leaders draw, the panel comes in. */
  panel: [0.22, 0.32],
  /** One slot per claim. */
  claims: [0.32, 0.8],
  /** The panel leaves and the leaders retract. */
  exit: [0.8, 0.88],
  /** The box shuts. */
  close: [0.88, 0.99],
} as const;

const CLAIMS = [
  {
    question: 'The cheapest work is the work it refuses',
    answer:
      'The quota is checked before a single byte is decompressed. A project over its limit gets a 429 and a Retry-After, and the rest of the machine never hears about the request at all.',
  },
  {
    question: 'It knows what everything is before it touches it',
    answer:
      'One request can carry errors, transactions, sessions, logs and spans at once. They are pulled apart into eight typed kinds under a hard size cap, and which handler each kind goes to was settled when the binary was compiled, not looked up again per event.',
  },
  {
    question: 'Your app stops waiting here',
    answer:
      'The event lands on disk and the 200 goes straight back. Everything expensive happens after your SDK has already moved on, and because it is on disk rather than in memory, a process that dies in between still has the event when it comes back.',
  },
  {
    question: 'One process, not five',
    answer:
      'Grouping, source maps, session rollups and alerts all run on threads the server already has. There is no queue to install, no broker to keep alive, no worker fleet to scale, and no garbage collector waiting to pause any of it.',
  },
  {
    question: 'A million crashes, one row',
    answer:
      'Every event gets a deterministic fingerprint, and identical crashes fold onto the same issue with a counter. A bad deploy at three in the morning costs you one row and a number going up, not a million rows.',
  },
];

const HEADING = {
  lead: 'Five parts, one process.',
  rest: 'This is every piece of the event processor that touches a crash, and the order it touches them in. Scroll the server open.',
};

/* -------------------------------------------------------------------------- */
/* The clock both stages run on                                                */
/* -------------------------------------------------------------------------- */

/**
 * Everything the acts drive, derived from one pinned track.
 *
 * Shared because the two stages are the same five-act sequence told at two
 * aspect ratios, and the moment they stop being that is the moment a change to
 * the pacing has to be made twice and gets made once. What differs between them
 * is only where things are put on screen, which is the part each one owns.
 */
function useActs(track: RefObject<HTMLDivElement | null>) {
  const { scrollYProgress } = useScroll({
    target: track,
    offset: ['start start', 'end end'],
  });

  /*
    The box. Opens over the first act, is held all the way through the claims,
    and shuts on the way out — one motion value with four stops rather than two
    separate animations, so the closing is literally the opening reversed and
    cannot drift out of agreement with it.
  */
  const open = useTransform(
    scrollYProgress,
    [ACT.open[0], ACT.open[1], ACT.close[0], ACT.close[1]],
    [0, 1, 1, 0],
  );

  /* The leaders and the panel share a clock, because they are one gesture. */
  const label = useTransform(
    scrollYProgress,
    [ACT.panel[0], ACT.panel[1], ACT.exit[0], ACT.exit[1]],
    [0, 1, 1, 0],
  );

  /*
    Which claim is being read.

    Derived from the same scroll value rather than from an observer, because on
    a pinned stage there is nothing travelling through the viewport for an
    observer to watch — the panel never moves. `useMotionValueEvent` keeps this
    off the render path: it fires per frame and only calls `setState` on the
    frames the index actually changes, which is four times in five screens.
  */
  const [active, setActive] = useState(-1);
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    if (p < ACT.claims[0] || p >= ACT.exit[0]) {
      setActive(-1);
      return;
    }
    const span = (ACT.claims[1] - ACT.claims[0]) / CLAIMS.length;
    const index = Math.min(
      CLAIMS.length - 1,
      Math.floor((p - ACT.claims[0]) / span),
    );
    setActive(index);
  });

  return { open, label, active };
}

/** The reader's position in the section, which a pinned frame otherwise hides
    completely: the scrollbar is moving and nothing says how much of this is
    left. */
function Ticks({ active, className }: { active: number; className?: string }) {
  return (
    <div className={`flex gap-1.5 ${className ?? ''}`}>
      {CLAIMS.map((item, index) => (
        <span
          key={item.question}
          className={
            index === active
              ? 'h-px flex-1 bg-primary transition-colors duration-500'
              : 'h-px flex-1 bg-rule transition-colors duration-500'
          }
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The pinned stage                                                            */
/* -------------------------------------------------------------------------- */

function Stage() {
  const track = useRef<HTMLDivElement>(null);
  const { open, label, active } = useActs(track);

  /*
    The drawing moves aside rather than shrinking into a column. Percentages of
    its own box, so it lands correctly at any width, and both of these are
    transforms — the compositor animates them for free, which matters on a
    pinned section where something is moving on every frame for five screens.
  */
  /*
    Sized against the narrowest desktop rather than the widest, which is the
    only way a pair of transform numbers can serve every viewport. At 1024 the
    stage is about 1000px of usable width, the panel takes 320 of it, and the
    drawing letterboxed into the remaining height comes out ~820 wide — so it
    has to come down to 0.82 and move a seventh of the frame left to clear the
    panel with a margin. On a wide monitor the same numbers simply leave more
    air on the left, which is the harmless direction to be wrong in.
  */
  const sceneX = useTransform(label, [0, 1], ['0%', '-15%']);
  const sceneScale = useTransform(label, [0, 1], [1, 0.82]);
  const panelX = useTransform(label, [0, 1], ['12%', '0%']);

  const claim = active >= 0 ? CLAIMS[active] : null;

  return (
    <div ref={track} style={{ height: TRACK }} className="relative">
      <div className="sticky top-16 h-[calc(100svh-4rem)] overflow-hidden">
        {/* The drawing. Centred in the whole frame to begin with, and pushed
            left only when there is something to make room for. */}
        {/* The drawing fills the held frame and letterboxes inside it. It used
            to be capped at `max-w-[46rem]` and centred, which on a tall stage
            left a third of the height empty and rendered the cube at about half
            the size the section had room for. */}
        {/* Vertical padding well beyond the horizontal, because the two are
            bounded by different things. Sideways there is the whole frame to
            play with; downward the stage starts immediately under a fixed nav
            and the drawing was landing hard against it. This is the air that
            keeps the cube sitting *in* the frame rather than wedged at the top
            of it, and it costs about 8% of the drawing's size to buy. */}
        <motion.div
          className="absolute inset-0 px-6 py-10 lg:px-8 lg:py-14"
          style={{ x: sceneX, scale: sceneScale }}
        >
          <EngineScene
            active={active}
            open={open}
            label={label}
            className="h-full w-full"
          />
        </motion.div>

        {/* The reading panel. Slides in with the leader lines and leaves with
            them, and shows one claim at a time rather than a list — the list
            is the drawing, and repeating it here in words would be asking the
            reader to look at the same five things twice. */}
        <motion.aside
          className="absolute inset-y-0 right-0 flex w-[20rem] items-center border-l border-rule bg-[var(--surface-soft)] px-7 xl:w-[22rem] xl:px-8"
          style={{ x: panelX, opacity: label }}
        >
          <div className="min-w-0">
            {/*
              Keyed and remounted, with no exit animation, and that is a
              deliberate choice against `AnimatePresence`.

              `mode="wait"` holds the incoming claim until the outgoing one has
              finished leaving, so a change costs exit plus enter back to back.
              That is fine when a human clicks a tab and wrong here: this panel
              is driven by a scrub, a reader can cross three claims in one flick
              of a trackpad, and the queue means the panel is still playing
              catch-up several claims after they stopped. Without `mode="wait"`
              the two animate together and overlap in the layout instead, which
              on a block of prose is a jump.

              Remounting on `key` sidesteps both: the outgoing claim is simply
              gone, the incoming one fades up from nothing, and however fast the
              reader scrolls the panel is never showing anything but the current
              claim.
            */}
            {claim ? (
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DUR.fast, ease: EASE }}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] tabular-nums text-primary">
                    {String(active + 1).padStart(2, '0')}
                  </span>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                    {PARTS[active].label}
                  </span>
                </div>

                <p className="mt-4 text-[19px] font-medium leading-snug tracking-[-0.015em] text-foreground">
                  {claim.question}
                </p>

                <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
                  {claim.answer}
                </p>
              </motion.div>
            ) : null}

            <Ticks active={active} className="mt-10" />
          </div>
        </motion.aside>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The portrait stage                                                          */
/* -------------------------------------------------------------------------- */

/**
 * How tall the reading panel is on a phone, reserved whether or not there is
 * anything in it yet.
 *
 * Fixed rather than fitted to the claim, and that is the whole trick of this
 * layout. The five answers are between 160 and 260 characters, which at this
 * measure is a two-line difference — and a panel that resized to each of them
 * would move the drawing above it on every claim change. On a stage whose one
 * job is to hold a frame still, a machine that hops up and down four times is
 * worse than a little slack at the bottom of the shortest claim.
 *
 * Sized to the longest answer at the narrowest width this stage runs at.
 */
const PANEL_H = '17.5rem';

/**
 * One row of the parts list, lighting as its component stands up.
 *
 * A component rather than a loop body because each row needs its own transform
 * and hooks cannot be called in a loop. The window is the same one
 * `engine-scene` stands the part up on — `0.26 + i · 0.06` — copied rather than
 * shared, which is the one duplication in this file worth the risk: exporting
 * it would tie the drawing's internal timing to a caption's, and the caption
 * being a frame behind is invisible where a locked API is not.
 */
function LegendRow({
  index,
  open,
}: {
  index: number;
  open: MotionValue<number>;
}) {
  /*
    Not from zero. The rows are an index as well as a caption, so the list is
    on the page from the first frame of the section — dim, all five, in the
    order the machine will assemble itself — and each one comes up to full as
    its part arrives. Starting at 0 left the panel genuinely blank for the
    first flick of the track, under a cube that had not started opening yet,
    and a third of a phone screen of nothing reads as a section that failed to
    render rather than one that has not begun.
  */
  const arrive = useTransform(
    open,
    [0.26 + index * 0.06, 0.5 + index * 0.06],
    [0.16, 1],
  );
  const part = PARTS[index];

  return (
    <motion.li
      className="flex items-baseline gap-3"
      style={{ opacity: arrive }}
    >
      <span className="font-mono text-[10.5px] tabular-nums text-primary">
        {String(index + 1).padStart(2, '0')}
      </span>
      <span className="text-[13.5px] text-foreground">{part.label}</span>
      <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">
        {part.note}
      </span>
    </motion.li>
  );
}

/**
 * What the panel holds before the claims start: the five parts, named.
 *
 * This is the portrait stage's answer to the label gutter, and it turned out to
 * be a better one than the leaders were. On the landscape stage the names
 * arrive all at once in act two, after the machine has finished assembling
 * itself; here each name arrives with the part it names, so the reader is told
 * what they are watching stand up at the moment it stands up.
 *
 * It also solves a plain layout problem. The panel's height is reserved from
 * the first frame of the section, and the claims do not start until act three —
 * so without this the slot spends the whole opening act as a third of a phone
 * screen of black under the drawing, which reads as the page having failed to
 * load something rather than as a panel waiting its turn.
 */
function Legend({ open }: { open: MotionValue<number> }) {
  return (
    <ul className="space-y-3">
      {PARTS.map((part, index) => (
        <LegendRow key={part.key} index={index} open={open} />
      ))}
    </ul>
  );
}

/**
 * The section on a phone: the same five acts, stacked instead of side by side.
 *
 * ── Why this exists at all ──────────────────────────────────────────────────
 *
 * It used to be a static drawing with the claims listed underneath, on the
 * reasoning that a phone has neither the width for a panel beside the machine
 * nor the patience for a section that will not move on. The second half of that
 * was right and the first half was answered the wrong way: a panel that will
 * not go *beside* the drawing goes *under* it, and a portrait screen has plenty
 * of room for both if the drawing stops carrying a label gutter it cannot set
 * type in.
 *
 * And the static version had a specific tell. The heading says "Scroll the
 * server open", and on a phone nothing happened when you did — the box was
 * already open when it arrived, so the section's own instruction read as a
 * desktop line that nobody had checked on a phone.
 *
 * ── What differs from the landscape stage ───────────────────────────────────
 *
 * Only the geometry. Same track, same acts, same claim clock.
 *
 * The drawing does not move aside, because there is nowhere sideways to go; it
 * simply gives up the bottom of the frame, which it can do for free since it is
 * letterboxed into whatever height it is left with. So there is no transform on
 * it at all — the panel is a flex sibling that is always in the layout, and the
 * drawing takes the rest. That is one fewer thing animating per frame than the
 * desktop version, on the device that can least afford it.
 *
 * The leaders and the gutter are gone with the width, so the panel carries the
 * part's name and its note. The note is the one thing the phone shows and the
 * desktop does not, and it is there because on desktop it is already in the
 * drawing.
 */
function PhoneStage() {
  const track = useRef<HTMLDivElement>(null);
  const { open, label, active } = useActs(track);

  /* The parts list holds the panel until the claims take it over. One value
     rather than two independent fades, so the hand-over cannot leave the slot
     briefly empty or briefly holding both. */
  const legend = useTransform(label, [0, 1], [1, 0]);

  const claim = active >= 0 ? CLAIMS[active] : null;

  return (
    <div ref={track} style={{ height: TRACK_PHONE }} className="relative">
      <div className="sticky top-16 flex h-[calc(100svh-4rem)] flex-col overflow-hidden">
        {/*
          The drawing, letterboxed into whatever the panel leaves it.

          `min-h-0` is load-bearing rather than defensive: a flex child's
          default `min-height: auto` refuses to shrink below its content, and
          an SVG at `h-full` inside one resolves to a height that then refuses
          to be the height it was given. Without it the drawing pushes the
          panel off the bottom of the held frame on a short phone.
        */}
        {/* No side padding. The frame is now sized to the drawing rather than
            to a gutter, so there is nothing in it that can touch an edge, and
            on a 390px screen the inset was costing scale for nothing. */}
        <div className="relative min-h-0 flex-1 pt-5 pb-1">
          <EngineScene
            active={active}
            open={open}
            label={label}
            named={false}
            className="h-full w-full"
          />
        </div>

        {/*
          The reading panel.

          The surface itself never animates — it is a fixed slot in the layout
          from the first frame to the last, and only what is inside it changes.
          Fading the whole panel in and out would mean the horizontal rule under
          the drawing appearing and disappearing twice per visit, which on a
          page built out of ruled bands reads as the frame breaking rather than
          as a panel arriving.
        */}
        <aside
          className="relative shrink-0 border-t border-rule bg-[var(--surface-soft)] px-5 pt-5 pb-6 sm:px-8"
          style={{ height: PANEL_H }}
        >
          {/* The two states of the slot, in the same box, cross-faded on the
              panel clock: the parts list while the machine assembles itself,
              then one claim at a time. */}
          <motion.div
            className="absolute inset-x-5 top-5 sm:inset-x-8"
            style={{ opacity: legend }}
          >
            <Legend open={open} />
          </motion.div>

          {/* Remounted on `key` with no exit animation, for the reason set out
              on the desktop panel: this is a scrub, and a thumb crosses three
              claims in one flick. */}
          {claim ? (
            <motion.div
              className="absolute inset-x-5 top-5 sm:inset-x-8"
              key={active}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.fast, ease: EASE }}
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] tabular-nums text-primary">
                  {String(active + 1).padStart(2, '0')}
                </span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                  {PARTS[active].label}
                </span>
                {/* The gutter's note, which has nowhere else to be now. */}
                <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">
                  {PARTS[active].note}
                </span>
              </div>

              <p className="mt-3.5 text-[17px] font-medium leading-snug tracking-[-0.015em] text-foreground">
                {claim.question}
              </p>

              <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
                {claim.answer}
              </p>
            </motion.div>
          ) : null}

          {/* Pinned to the bottom edge rather than flowing after the prose, so
              it sits in one place across five claims of different lengths. */}
          <Ticks
            active={active}
            className="absolute inset-x-5 bottom-5 sm:inset-x-8"
          />
        </aside>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The unpinned fallback                                                       */
/* -------------------------------------------------------------------------- */

/**
 * What the exported HTML contains, and what reduced motion gets.
 *
 * Both stages depend on holding one frame still while several screens of
 * scrolling drive it — the first is a scroll-linked animation and the second is
 * the same animation, so neither is something to offer a reader who has asked
 * the machine to stop moving. This is that reader's version: the drawing
 * already open, once, and the claims as an ordinary list underneath.
 *
 * It is also what the server renders, since `useMediaQuery` starts `false`
 * everywhere — which is the right way round: every word of the copy is in the
 * HTML, and both stages are the enhancement that arrives late.
 */
function Stacked() {
  const held = useMotionValue(1);

  return (
    <div className="border-t border-rule">
      {/* Unnamed, at every width this is reached at. The gutter's type is
          authored in viewBox units, so on a phone it renders at about 5px —
          and the list underneath names all five parts anyway, which makes the
          leaders a second copy of a label rather than the only one. */}
      <div className="bg-[var(--surface-soft)] px-4 py-10 sm:px-8">
        <EngineScene
          active={-1}
          open={held}
          label={held}
          /* Capped and centred rather than full width. The portrait frame is
             very nearly square, so at the band's full width on a monitor it
             would render a metre-tall drawing of a cube. */
          className="mx-auto h-auto w-full max-w-[32rem] sm:max-w-[38rem]"
          named={false}
        />
      </div>

      <ul className="border-t border-rule">
        {CLAIMS.map((claim, index) => (
          <li
            key={claim.question}
            className={`px-5 py-8 sm:px-10 sm:py-9 ${
              index < CLAIMS.length - 1 ? 'border-b border-rule' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] tabular-nums text-primary">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                {PARTS[index].label}
              </span>
            </div>
            <p className="mt-3 max-w-[30ch] text-[17px] font-medium leading-snug tracking-[-0.015em] text-foreground">
              {claim.question}
            </p>
            <p className="mt-2.5 max-w-[52ch] text-[13.5px] leading-relaxed text-muted-foreground sm:text-[14.5px]">
              {claim.answer}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Three renderings of one section, chosen in this order.
 *
 * Reduced motion is asked first and answers for every width: a scroll-linked
 * scrub is the thing that setting is about, and a portrait one is not a gentler
 * version of it.
 *
 * The two queries are complements rather than a single boolean because both
 * start `false` — so the server and the first client render both produce
 * `Stacked`, which is the version with all five claims in the markup. Whichever
 * stage the viewport wants then replaces it. A single `desktop ? … : …` would
 * have made the phone stage the server-rendered case, and the phone stage has
 * one claim in the DOM at a time.
 */
export function Engine() {
  const desktop = useMediaQuery(DESKTOP);
  const compact = useMediaQuery(COMPACT);
  const reduced = useReducedMotion();

  let stage = <Stacked />;
  if (!reduced && desktop) stage = <Stage />;
  else if (!reduced && compact) stage = <PhoneStage />;

  return (
    <Band>
      <Cell className="max-w-[52rem] pb-6 sm:pb-10">
        <Pill>Engine</Pill>
        <Heading
          className="display-lg mt-6"
          lead={HEADING.lead}
          rest={HEADING.rest}
          scrub
        />
      </Cell>

      {stage}
    </Band>
  );
}
