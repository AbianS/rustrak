'use client';

import {
  type MotionValue,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import Link from 'next/link';
import { Fragment, type ReactNode, useRef } from 'react';
import { GithubIcon } from '@/components/icons/github';
import StaggerFromCenter from '@/components/smoothui/stagger-from-center';
import { AppFrame } from '../app-mock/app-frame';
import { MockOverview } from '../app-mock/mock-overview';
import { IssueCard, SessionCard, TraceCard } from '../app-mock/satellites';
import { Drift, IdleProvider, useSettled } from '../app-mock/stage';
import { AsciiField } from '../ascii-field';
import { GITHUB } from '../links';
import { EASE } from '../motion';
import { Typewriter } from '../primitives/typewriter';
import { DESKTOP, useMediaQuery } from '../use-media-query';
import { useOnScreen } from '../use-on-screen';
import { useStarted } from '../use-started';

/**
 * Sets a line character by character from its middle outwards, keeping line
 * breaks on word boundaries.
 *
 * `StaggerFromCenter` renders every character as its own `inline-block`, and a
 * line break may fall between any two inline-blocks — so a bare line of it
 * wraps mid-word. Each word therefore gets its own non-breaking box, with the
 * spaces left outside as the only break opportunities.
 *
 * Splitting per word would normally make each word radiate from its own
 * centre. To keep one centre for the whole line, each word is delayed by how
 * far its own centre sits from the line's, so the reveal still opens in the
 * middle and travels out to both ends.
 */
function Words({
  text,
  active,
  delay = 0,
  stagger = 15,
}: {
  text: string;
  /** Held until the page has started, so the setting is not half over by then. */
  active: boolean;
  delay?: number;
  stagger?: number;
}) {
  const words = text.split(' ');
  const lineCenter = (text.length - 1) / 2;
  let cursor = 0;

  return (
    <>
      {words.map((word, index) => {
        const wordCenter = cursor + (word.length - 1) / 2;
        cursor += word.length + 1;
        const offset = Math.abs(wordCenter - lineCenter) * stagger;

        return (
          // Words are a fixed authored sentence, never reordered.
          <Fragment key={`${index}-${word}`}>
            <span className="inline-block">
              {active ? (
                <StaggerFromCenter delay={delay + offset} stagger={stagger}>
                  {word}
                </StaggerFromCenter>
              ) : (
                // Present in the markup so the copy is in the exported HTML,
                // just not painted yet.
                <span className="opacity-0">{word}</span>
              )}
            </span>
            {index < words.length - 1 ? ' ' : null}
          </Fragment>
        );
      })}
    </>
  );
}

interface Satellite {
  node: ReactNode;
  z: number;
  /** Offsets from the composition's own box, as fractions of it. */
  left?: string;
  right?: string;
  top: string;
  width: string;
  /** Where it travels in from, in pixels. */
  from: { x: number; y: number };
}

/**
 * The windows that orbit the hero panel, placed as fractions of the
 * composition rather than in pixels so the arrangement holds its proportions
 * at every width.
 *
 * `z` is the point of it. The panel sits at 30, so the issue row and the trace
 * pass *behind* it and only the session card comes in front. Layering them all
 * on top would read as three cards dropped onto a screenshot; threading the
 * panel through the middle of the stack is what gives the group depth.
 *
 * Which one comes forward is not arbitrary. The front card overlaps the screen
 * it is sitting on, so it has to be the one that can be read without being
 * studied — a single large percentage, rather than a row or a waterfall.
 */
const SATELLITES: Satellite[] = [
  {
    node: <IssueCard />,
    z: 20,
    left: '-17%',
    top: '-6%',
    width: '26%',
    from: { x: -90, y: -40 },
  },
  {
    node: <TraceCard />,
    z: 10,
    right: '-18%',
    top: '5%',
    width: '26%',
    from: { x: 100, y: -24 },
  },
  {
    node: <SessionCard />,
    z: 40,
    left: '-15%',
    top: '44%',
    width: '29%',
    from: { x: -100, y: 56 },
  },
];

/**
 * The second line of the headline, rotating.
 *
 * These are the four things "own" actually means, and they are deliberately
 * flat statements of fact rather than benefits. The stem makes the claim; each
 * of these is something a reader can go and check, which is the only way a
 * claim like "you own it" survives contact with a sceptical developer.
 *
 * The headline used to name Sentry outright, and it was cut for being a promise
 * the product does not keep. Rustrak speaks the Sentry protocol and answers the
 * Sentry SDKs; it is not a feature-for-feature replacement for a company with
 * hundreds of engineers, and a headline that implies otherwise gets found out
 * on the first visit. Compatibility is a fact, and it is stated where it is
 * true — in the SDK strip and in the migration section — instead of being
 * inflated into a headline.
 *
 * Ordered so the first is the strongest, because it is the one a reader who
 * never waits still gets: it is also the phrase exposed to assistive tech and
 * the one shown outright under reduced motion.
 */
const TAILS = [
  'One binary.',
  'Your database.',
  'No per-event bill.',
  'GPL-3.0.',
] as const;

/**
 * Scroll distance, in pixels, that the whole opening move is spread over.
 * Long enough that the move is not over on the first flick of the wheel,
 * short enough that the opening does not turn into a corridor you have to
 * scroll down before the page starts.
 */
const RUN = 850;

export function Hero() {
  const started = useStarted();
  const reduced = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  /*
    The rotating claim, and whether it is on screen. Gates its sheen.

    The margin is what keeps the gate from being visible. The sheen restarts
    from its first keyframe whenever it is re-armed, so opening the gate flush
    with the viewport edge would snap the gradient across the letters at the
    exact moment they came into view. Opening it a screenful early means the
    restart has already happened by the time there is anything to see.
  */
  const claim = useRef<HTMLSpanElement>(null);
  const onClaim = useOnScreen(claim, { rootMargin: '400px' });

  /*
    The satellites only exist from `lg` up — below it they would either cover
    the panel they annotate or shrink past legibility. Everything that exists
    *for* them has to go with them, which is the whole opening move: the pull
    back, and the tall track it needs to happen in.

    Left in place on a phone it was worse than pointless. The panel is already
    the narrowest it will ever be, so shrinking it a further 16% bought room
    for nothing, and the 138vh track pinned it through more than a screen of
    scrolling while nothing arrived. What a phone gets instead is the panel at
    full size, held briefly and then released.
  */
  const orbiting = useMediaQuery(DESKTOP) && !reduced;

  const { scrollY } = useScroll();

  // The composition scales as one piece, panel and satellites together. That
  // is what makes room for them: at rest the panel is as wide as the page
  // allows and there is nowhere for a card to sit, so the group has to pull
  // back before the group can exist.
  const scale = useTransform(scrollY, [0, RUN], [1, 0.84], { clamp: true });
  // Held back so the first stretch of scrolling is purely the panel receding.
  // The satellites arriving on the very first wheel click was the thing that
  // made this feel like a trick rather than a reveal.
  const orbit = useTransform(scrollY, [RUN * 0.3, RUN * 0.92], [0, 1], {
    clamp: true,
  });

  /*
    Not a visual. The pinned hero's box never travels through the viewport, so
    a measured "how far past centre am I" would read 0 forever — which would
    leave the dashboard's counters ticking and the satellites floating long
    after the section had scrolled away. Read off the *track* instead, in track
    units rather than pixels so it behaves the same on a laptop and on a tall
    monitor, and used only to shut the idle loops off.

    All of which is true only while the panel is pinned. Below `lg` it is an
    ordinary element travelling down the page, and `MockStage` already knows
    how to measure one of those — so the override is withdrawn (see `gate`
    below) and the track reading is left unused rather than made to mean
    something on a box it no longer describes.
  */
  const { scrollYProgress: pin } = useScroll({
    target: track,
    offset: ['start start', 'end end'],
  });
  const past = useTransform(pin, [0.72, 1], [0, 1], { clamp: true });

  // The satellites' idle window: assembled, and still on screen.
  const composed = useSettled(orbit, past, !reduced);

  /** Everything above the panel enters on one clock, started at mount. */
  const enter = (delay: number, duration = 1) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: started ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 },
          transition: { duration, ease: EASE, delay },
        };

  return (
    <section className="relative overflow-x-clip">
      {/*
        Both layers span the section and are keyed off fixed pixel distances
        from its top rather than off its height, which is what lets them behave
        the same whatever the track ends up measuring.

        The headline sits in clear space, then the tint starts lifting from
        380px — low enough to be under the buttons and the top of the panel on
        the first screen, so there is already colour on the page before anyone
        scrolls, and high enough that nothing competes with the headline.
      */}
      {/*
        The wash, in the page's own colour rather than in lime.

        It used to be 14% primary, and the problem was never the amount: a tint
        colours the space *between* the glyphs as well as the glyphs, so the
        painting stopped being lime marks on black and became a lime area. Any
        strength of green does that; less green just does it more quietly.

        Black does the opposite thing for the same reason. It cannot tint what
        is already the background, so it has no effect at all on the empty space
        and acts only on the picture — which is exactly the one thing that
        should be receding. The painting simply sinks into the page as you go
        down, instead of the page turning green.

        ── There is no wash here any more ──────────────────────────────────────

        A lime gradient used to run down this section: transparent at 300px,
        14% primary by 1400px. It is gone, and the reasoning is worth keeping
        because the obvious replacements were all tried and none of them works.

        Turning it down did not fix it, because the amount was never the
        problem. A tint colours the space *between* the glyphs as well as the
        glyphs, so any strength of green stops the painting being lime marks on
        black and makes it a lime area — less green just does that more
        quietly.

        Doing the same thing in the page's own colour cannot work either, in
        either direction, and this one is worth writing down because it sounds
        like the right answer: the background *is* `oklch(0.14 0 0)`. Painting
        near-black over near-black has nothing to do. What made the original
        noticeable was that it added something, and black has nothing to add.

        So the picture is left alone, and the join into the ruled frame is
        carried by the canvas's own bottom mask instead — which is where a fade
        belongs anyway, since that is the element that actually has something
        to fade.
      */}
      {/*
        The painting, pinned.

        Stacking several different paintings down the section was tried and
        abandoned: the seams between them never read as anything but seams, and
        two extra pictures competing behind the product panel bought nothing.
        One painting that *stays* is the stronger move — it holds the whole
        opening together instead of handing off.

        The track is the whole section rather than a fixed height. It was 1700px
        at first, which left the last few hundred pixels bare once the pinned
        panel had scrolled past — `inset-0` follows whatever the section
        actually measures, so there is nothing left to leave uncovered. Sticky
        rather than fixed so it lets go on its own, without a scroll listener.
      */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="sticky top-0 h-svh">
          <AsciiField
            source="/last-supper.txt"
            active={started}
            className="top-0 h-full"
            /* Matched to the manifesto band. The hero had always been on the
               default of 1, which is why it read so much greener than every
               other painting on the page: same lime, twice the alpha. */
            intensity={1}
            scrim
          />
        </div>
      </div>

      <div className="relative px-5 pt-32 text-center sm:px-6 sm:pt-48">
        {/*
          The stem is set character by character from the middle outwards.
          `StaggerFromCenter` splits into `inline-block` characters, which lets
          a line break fall between any two of them and snap a word in half, so
          each segment is wrapped in `Words` to keep the breaking on word
          boundaries where it belongs.

          It waits for the client rather than rendering set on the server, so
          an invisible copy holds the space in the meantime and nothing shifts
          when the letters arrive.
        */}
        {/* `text-balance` sits on the stem rather than on the `h1`, and that
            placement is load-bearing rather than tidy. It is an inherited
            property, so on the `h1` it also applied to the rotating tail below
            — and balancing re-runs the line-breaking algorithm on every change
            to the text inside the box. The tail changes width sixteen times a
            second while it types, so the whole headline was being re-balanced
            at that rate. The tail is one nowrap line and has nothing to
            balance anyway. */}
        <h1 className="display-xl mx-auto max-w-[24ch] text-foreground">
          <span className="block text-balance">
            <Words
              text="Error tracking you actually own."
              active={started}
              stagger={26}
            />
          </span>

          {/*
            The ending goes on its own line, and that is a layout decision the
            typewriter forces: the phrase changes width every few seconds, and
            sharing a line with the stem would shove the stem sideways on every
            keystroke. Alone and centred, it grows and shrinks around its own
            middle and nothing above it moves.
          */}
          <span ref={claim} className="relative mt-1 block">
            <motion.span
              className="inline-block bg-[linear-gradient(105deg,var(--primary)_28%,color-mix(in_oklab,var(--primary)_35%,white)_44%,var(--primary)_60%)] bg-clip-text text-transparent [background-size:260%_100%]"
              initial={
                reduced
                  ? { backgroundPosition: '170% 0%' }
                  : { opacity: 0, y: 12, filter: 'blur(3px)' }
              }
              animate={
                started && !reduced
                  ? {
                      opacity: 1,
                      y: 0,
                      filter: 'blur(0px)',
                      // A light travels across the claim and moves on. Only
                      // the gradient's position animates, so the whole effect
                      // is one composited property on one element — and it
                      // runs long with a pause between passes, which is the
                      // difference between a sheen and a novelty.
                      //
                      // Dropped entirely once the headline is off screen. Not
                      // for what this one element costs, but because Motion's
                      // frame loop only sleeps when nothing at all is
                      // animating: left running, this alone kept the whole
                      // scheduler awake for the life of the page, and every
                      // other loop on the landing being gated would have
                      // bought nothing.
                      ...(onClaim
                        ? {
                            backgroundPosition: [
                              '170% 0%',
                              '170% 0%',
                              '-60% 0%',
                            ],
                          }
                        : null),
                    }
                  : undefined
              }
              transition={{
                opacity: {
                  duration: 0.9,
                  delay: 0.7,
                  ease: [0.22, 1, 0.36, 1],
                },
                y: { duration: 0.9, delay: 0.7, ease: [0.22, 1, 0.36, 1] },
                filter: {
                  duration: 0.9,
                  delay: 0.7,
                  ease: [0.22, 1, 0.36, 1],
                },
                backgroundPosition: {
                  duration: 4.6,
                  times: [0, 0.43, 1],
                  ease: 'easeInOut',
                  repeat: Number.POSITIVE_INFINITY,
                  repeatDelay: 4,
                  delay: 1.6,
                },
              }}
            >
              {/*
                Four endings to one sentence. Each is a different reason the
                same claim is true — the memory, the artifact, the deployment,
                the ownership — so the line argues four times in the space of
                one, and the reader never has to re-read the stem.

                `caretClassName` paints the caret in the flat accent: the
                gradient above is clipped to glyph shapes, and a bare element
                inside it would come out invisible.
              */}
              <Typewriter
                phrases={TAILS}
                active={started}
                caretClassName="bg-primary"
              />
            </motion.span>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -bottom-2 -z-10 h-10 blur-2xl [background:radial-gradient(50%_100%_at_50%_50%,color-mix(in_oklab,var(--primary)_28%,transparent),transparent_70%)]"
            />
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-[52ch] text-pretty text-[15.5px] leading-relaxed text-muted-foreground sm:mt-7 sm:text-[17px]">
          <Words
            text="Your app already knows how to report crashes. Point it at a server you run, and the stack traces never leave the building."
            active={started}
            delay={1000}
            stagger={11}
          />
        </p>

        {/* Both buttons fit on one line at 390px, but only just, and a wrapped
            pair of differently-sized pills reads as an accident. Below `xs`
            they stack full width instead, which is also the shape a thumb
            expects. */}
        <motion.div
          className="mx-auto mt-8 flex max-w-xs flex-col items-stretch gap-3 sm:mt-9 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center"
          {...enter(1.05)}
        >
          <Link
            href="/getting-started/quickstart"
            className="rounded-lg bg-primary px-4 py-3 text-center text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:py-2.5 sm:text-[14px]"
          >
            Get started
          </Link>
          <a
            href={GITHUB}
            /*
              A fill, not a louder outline.

              This sits over the painting, and a hairline border with nothing
              behind it has no chance there: an ASCII field is texture at exactly
              the frequency a 1px edge lives at, so the button's own outline was
              competing with thousands of glyphs the same weight. Turning the
              border up would have won that fight by shouting, next to a solid
              lime primary that has every right to be the loud one.

              A very slightly lifted surface fixes it a different way. `bg-white/6`
              is not visible as a colour — what it does is give the label a
              consistent ground instead of whatever glyphs happen to be behind
              it, so the edge reads as a shape rather than as one more line in
              the noise. Deliberately not `backdrop-blur`: the background here
              repaints, and a backdrop filter over a repainting canvas is
              re-read every frame.
            */
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/18 bg-white/6 px-4 py-3 text-[15px] font-medium text-white/90 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white sm:py-2.5 sm:text-[14px]"
          >
            <GithubIcon className="size-4" />
            View on GitHub
          </a>
        </motion.div>
      </div>

      {/*
        A tall track with the composition pinned inside it. Without the pin the
        move has only the height of one screen to happen in, which is why it
        felt rushed: the panel was leaving the viewport before the satellites
        had finished arriving. Pinned, the scroll buys time instead of
        distance.

        None of which applies below `lg`, where there are no satellites to wait
        for. A pin with nothing arriving during it is just a section that will
        not scroll: the panel hung in place for over a screen's worth of thumb
        while the page appeared to be stuck. So the track has no extra height
        there and the panel does not stick — it arrives, it is read, it leaves,
        and the section is only as tall as the thing in it.
      */}
      <div ref={track} className="relative mt-14 sm:mt-20 lg:h-[138vh]">
        <div className="px-3 sm:px-6 lg:sticky lg:top-[13vh] lg:px-10">
          {/*
            The panel's arrival.

            It lives here rather than on the track, and that placement is the
            fix: a transform on the track would have been an ancestor transform
            over its own `sticky` child, which changes what the child sticks to.
            Nested inside, the entrance and the pin never touch.

            Held until the painting behind it has finished resolving — the
            reveal runs about 2.75s, and this used to land at 1.25, straight
            through the middle of the one moment the background is doing
            something.

            It was also just a fade with 18px of travel, which is why it
            appeared rather than arrived. Now it rises further and from further
            back, over nearly two seconds: the same move a camera makes settling
            onto a subject.

            That move used to include a 9px blur, on the theory that blur is
            affordable if it is one element. It is not, when the element has
            five hundred descendants: the whole panel had to be rasterised to a
            buffer and gaussian-blurred on every frame for 1.9 seconds, while
            simultaneously scaling — and it landed at the two second mark, on
            top of the headline setting itself and the background resolving.
            Pulling the scale back further (0.92 rather than 0.94) buys the same
            sense of a subject being approached, out of two properties the
            compositor animates for free.
          */}
          <motion.div
            initial={reduced ? undefined : { opacity: 0, y: 72, scale: 0.92 }}
            animate={
              reduced || !started ? undefined : { opacity: 1, y: 0, scale: 1 }
            }
            transition={{ duration: 1.9, ease: EASE, delay: 2 }}
          >
            <motion.div
              className="relative mx-auto w-full max-w-[1160px]"
              style={orbiting ? { scale } : undefined}
            >
              <div className="relative z-30">
                {/*
                The one screen that plays on entry rather than on scroll: it is
                already on the page at first paint, so scrubbing it would mean
                an empty dashboard until the visitor scrolled. `armed` holds the
                boot-up until the client is alive to run it.

                Its idle phase then runs for as long as the panel is pinned:
                the lifetime event counter keeps accruing, the current hour's
                bar keeps filling, light crosses the surface. That is the whole
                first impression, so it is the last place a frozen screenshot
                would do.

                ── Why the fill-in is delayed ─────────────────────────────────

                `armed` answers "is there a client alive to run this", which
                turned out not to be the question. Armed at mount, the fill-in
                ran from 0 to 1.9s — and the panel wrapping it is at `opacity: 0`
                until 2s. Every mark on this dashboard animated where nobody
                could see it, and finished at the exact moment the panel began
                to appear. The visitor got a complete, static dashboard fading
                in: the one thing the comment above says this must not be.

                It also cost. Measured over the opening, those sixty-odd motion
                values were landing on the same frames as the background
                painting's reveal, and that overlap is where the page fell from
                120fps to 64.

                So it starts at 2.3s instead: three tenths of a second behind
                the panel's own arrival, trailing it the whole way, which is the
                same "the frame is there to receive them" ordering the platform
                chapters use (see `primitives/layered.tsx`).
              */}
                <AppFrame>
                  {/* The gate is only supplied while the panel is pinned.
                      Unpinned, `MockStage` measures its own travel through the
                      viewport, which is both correct and what every other
                      screen on the page already does. */}
                  <MockOverview
                    mode="enter"
                    armed={started}
                    enterDelay={2.3}
                    gate={orbiting ? past : undefined}
                  />
                </AppFrame>
              </div>

              {/* Not merely hidden below `lg` — not mounted. Three extra
                  screens of DOM and nine scroll transforms are exactly the
                  weight a phone should not be carrying for something it will
                  never see. */}
              {orbiting
                ? SATELLITES.map((satellite, index) => (
                    <Orbiting
                      key={satellite.z}
                      satellite={satellite}
                      progress={orbit}
                      idle={composed}
                      index={index}
                    />
                  ))
                : null}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Orbiting({
  satellite,
  progress,
  idle,
  index,
}: {
  satellite: Satellite;
  progress: MotionValue<number>;
  idle: boolean;
  index: number;
}) {
  const opacity = useTransform(progress, [0, 0.6], [0, 1]);
  const x = useTransform(progress, [0, 1], [satellite.from.x, 0]);
  const y = useTransform(progress, [0, 1], [satellite.from.y, 0]);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute hidden lg:block"
      style={{
        zIndex: satellite.z,
        top: satellite.top,
        left: satellite.left,
        right: satellite.right,
        width: satellite.width,
        opacity,
        x,
        y,
      }}
    >
      {/* Idle: they float once they have arrived, out of phase with each other
          and with the panel they orbit. Three planes at three cadences is what
          reads as depth. */}
      <IdleProvider value={idle}>
        <Drift distance={8} duration={11 + index * 1.5} phase={index * 2.2}>
          {satellite.node}
        </Drift>
      </IdleProvider>
    </motion.div>
  );
}
