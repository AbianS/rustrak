'use client';

import {
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import * as m from 'motion/react-m';
import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';
import { GithubIcon } from '@/components/icons/github';
import StaggerFromCenter from '@/components/smoothui/stagger-from-center';
import { AppFrame } from '../app-mock/app-frame';
import { MockOverview } from '../app-mock/mock-overview';
import { Tour } from '../app-mock/tour';
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
          // react-doctor-disable-next-line react-doctor/no-array-index-as-key
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

/**
 * The second line of the headline, rotating.
 *
 * The four things "own" actually means, as flat statements of fact rather than
 * benefits — each is something a reader can go and check, which is the only way
 * a claim like "you own it" survives contact with a sceptical developer.
 *
 * The headline deliberately does not name Sentry. Rustrak speaks the Sentry
 * protocol and answers the Sentry SDKs; it is not a feature-for-feature
 * replacement, and a headline implying otherwise gets found out on the first
 * visit. Compatibility is stated where it is true, in the SDK strip and the
 * migration section.
 *
 * Ordered strongest first: that phrase is what a reader who never waits gets,
 * and it is the one exposed to assistive tech and shown under reduced motion.
 */
const TAILS = [
  'One binary.',
  'Your server.',
  'Your database.',
  'Your data.',
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

  /*
    The rotating claim, and whether it is on screen. Gates its sheen.

    The generous margin is what keeps the gate itself from being visible: the
    sheen restarts from its first keyframe whenever it is re-armed, so opening
    the gate flush with the viewport edge would snap the gradient across the
    letters at the exact moment they came into view.
  */
  const claim = useRef<HTMLSpanElement>(null);
  const onClaim = useOnScreen(claim, { rootMargin: '400px' });

  /*
    The tour only runs from `lg` up, and everything that exists for it goes with
    it: the pull back, and the tall track that buys it time on screen. On a
    phone a screen swapping under a reader holding the page still with their
    thumb is a layout shift they did not ask for, so a phone gets the overview
    at full size instead, played once.
  */
  const held = useMediaQuery(DESKTOP) && !reduced;

  const { scrollY } = useScroll();

  /* The camera settling back as the reader starts to scroll, so the panel reads
     as something being stepped away from rather than a picture at a fixed size.
     Six percent is enough to feel and not enough for anything to depend on. */
  const scale = useTransform(scrollY, [0, RUN], [1, 0.94], { clamp: true });

  /*
    Whether the panel is on screen at all, and the gate that follows from it.

    An observer on the panel rather than a threshold on the pin's progress.
    Progress through a 138vh corridor is not the viewport: at 72% of the track
    the panel is still sitting mid-screen and fully visible, and reading the
    gate off it froze the tour, the pointer and the log tail under a reader who
    had merely scrolled a little. `MockStage` wants this as a `MotionValue`
    where anything above 0.06 means gone, so the boolean is published into one.
  */
  const panel = useRef<HTMLDivElement>(null);
  const visible = useOnScreen(panel, { rootMargin: '15% 0px' });
  const gate = useMotionValue(0);

  useEffect(() => {
    gate.set(visible ? 0 : 1);
  }, [visible, gate]);

  /*
    Whether the pointer currently has the headline's caret.

    Owned here because the two ends of it are siblings: the caret is in the `h1`
    and the pointer is in the panel, and this is the nearest thing that renders
    both.
  */
  const [caretAway, setCaretAway] = useState(false);

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
        The painting, pinned. One that stays rather than several handing off
        down the section: the seams between stacked paintings never read as
        anything but seams.

        The track is the whole section rather than a fixed height, so `inset-0`
        follows whatever the section measures and nothing is left bare once the
        pinned panel has scrolled past. Sticky rather than fixed, so it lets go
        on its own without a scroll listener.

        There is deliberately no tint over it. A wash colours the space
        *between* the glyphs as well as the glyphs, so any strength of green
        stops the painting being lime marks on black and makes it a lime area;
        and doing it in the page's own near-black has nothing to add over a
        near-black background. The join into the ruled frame is carried by the
        canvas's own bottom mask instead.
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
        {/* `text-balance` sits on the stem rather than on the `h1`, and the
            placement is load-bearing. It inherits, so on the `h1` it also
            applied to the rotating tail — and balancing re-runs line-breaking
            on every change to the text inside the box, which for a tail that
            changes width sixteen times a second means re-balancing the whole
            headline at that rate. */}
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
            <m.span
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
                      // A light travels across the claim and moves on: only
                      // the gradient's position animates, so the effect is one
                      // composited property on one element.
                      //
                      // Dropped entirely once the headline is off screen. Not
                      // for what this element costs, but because Motion's frame
                      // loop only sleeps when nothing at all is animating —
                      // left running, this alone kept the scheduler awake for
                      // the life of the page and every other gated loop on the
                      // landing would have bought nothing.
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
                The caret at the end of this line is also the product pointer:
                at 2.5s the bar leaves, unfolds into an arrow and drifts down
                into the panel to click through the app, and the line draws its
                own caret again a few seconds later. See `app-mock/cursor.tsx`.

                `caretClassName` paints it in the flat accent — the gradient
                above is clipped to glyph shapes, so a bare element inside it
                would come out invisible.
              */}
              <Typewriter
                phrases={TAILS}
                active={started}
                caretClassName="bg-primary"
                /* Only while there is a pointer holding it. `Tour` hands the
                   caret over and gives it back a few seconds later, but it is
                   mounted on `held` — so a window dragged under 1024px, or
                   reduced motion switched on, unmounts it mid-loan and the
                   caret is never returned. Reading the loan through the same
                   condition that grants it, there is nothing to reset. */
                handedOver={held && caretAway}
              />
            </m.span>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -bottom-2 -z-10 h-10 blur-2xl [background:radial-gradient(50%_100%_at_50%_50%,color-mix(in_oklab,var(--primary)_28%,transparent),transparent_70%)]"
            />
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-[52ch] text-pretty text-[15.5px] leading-relaxed text-muted-foreground sm:mt-7 sm:text-[17px]">
          <Words
            text="Works with the Sentry SDKs you already use. Change one line of config and every event lands on infrastructure you control."
            active={started}
            delay={1000}
            stagger={11}
          />
        </p>

        {/* Both buttons fit on one line at 390px, but only just, and a wrapped
            pair of differently-sized pills reads as an accident. Below `xs`
            they stack full width instead, which is also the shape a thumb
            expects. */}
        <m.div
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
              A fill, not a louder outline. This sits over the painting, and an
              ASCII field is texture at exactly the frequency a 1px edge lives
              at, so a hairline border competes with thousands of glyphs of the
              same weight. `bg-white/6` is not visible as a colour; it gives the
              label a consistent ground so the edge reads as a shape rather than
              one more line in the noise. Deliberately not `backdrop-blur` — the
              background here repaints, and a backdrop filter over a repainting
              canvas is re-read every frame.
            */
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/18 bg-white/6 px-4 py-3 text-[15px] font-medium text-white/90 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white sm:py-2.5 sm:text-[14px]"
          >
            <GithubIcon className="size-4" />
            View on GitHub
          </a>
        </m.div>
      </div>

      {/*
        A tall track with the panel pinned inside it, so the scroll buys time
        rather than distance: the tour is five screens at five to seven seconds
        each, and unpinned the panel scrolls away a third of the way through.

        None of which applies below `lg`, where there is no tour to wait for and
        a pin with nothing happening during it is just a section that will not
        scroll — so there the track has no extra height and nothing sticks.
      */}
      <div className="relative mt-14 sm:mt-20 lg:h-[138vh]">
        <div className="px-3 sm:px-6 lg:sticky lg:top-[13vh] lg:px-10">
          {/*
            The panel's arrival, nested inside the track rather than applied to
            it: a transform on the track would be an ancestor transform over its
            own `sticky` child, which changes what the child sticks to.

            Delayed until the painting behind it has finished resolving, which
            takes about 2.75s. Opacity and scale only — a blur here reads well
            and costs badly, since an element with five hundred descendants has
            to be rasterised to a buffer and gaussian-blurred every frame for
            the whole 1.9s. A deeper scale buys the same sense of a subject
            being approached out of properties the compositor animates for free.
          */}
          <m.div
            initial={reduced ? undefined : { opacity: 0, y: 72, scale: 0.92 }}
            animate={
              reduced || !started ? undefined : { opacity: 1, y: 0, scale: 1 }
            }
            transition={{ duration: 1.9, ease: EASE, delay: 2 }}
          >
            <m.div
              ref={panel}
              className="relative mx-auto w-full max-w-[1160px]"
              style={held ? { scale } : undefined}
            >
              {held ? (
                /*
                  The product using itself: a pointer clicks through five
                  screens, each playing its own entrance (`app-mock/tour.tsx`).
                  A reader looking at one held dashboard learns that there is a
                  dashboard; a reader watching the issue list open into a stack
                  trace, then a log stream, then an agent waterfall, learns the
                  shape of the whole product before scrolling once.

                  It opens its own `AppFrame`, because the pointer starts below
                  the product and the frame hides its overflow.
                */
                <Tour
                  armed={started && visible}
                  gate={gate}
                  onCaret={setCaretAway}
                />
              ) : (
                /*
                  Below `lg`: the overview alone, played once on entry rather
                  than scrubbed on scroll, since it is already on the page at
                  first paint and scrubbing would mean an empty dashboard until
                  the visitor scrolled.

                  The fill-in trails the panel by three tenths of a second
                  rather than starting at mount. `armed` answers "is there a
                  client alive to run this", not "is there anything to see": the
                  panel is at `opacity: 0` until 2s, so an unheld fill-in
                  animated sixty-odd motion values where nobody could watch them
                  — on the same frames as the painting's reveal, which is where
                  the opening fell from 120fps to 64.
                */
                <AppFrame>
                  <MockOverview mode="enter" armed={started} enterDelay={2.3} />
                </AppFrame>
              )}
            </m.div>
          </m.div>
        </div>
      </div>
    </section>
  );
}
