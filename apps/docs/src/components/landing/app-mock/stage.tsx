'use client';

import {
  animate,
  cubicBezier,
  type MotionValue,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import * as m from 'motion/react-m';
import {
  type CSSProperties,
  createContext,
  type ReactNode,
  type SVGProps,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import { EASE } from '../motion';
import { useOnScreen } from '../use-on-screen';
import { StageGateContext, WindowProgressContext } from './window-progress';

/**
 * The motion vocabulary the recreated screens share.
 *
 * Every screen is real DOM rather than a screenshot, and this is the reason to
 * bother: the product can be shown *running*.
 *
 * It is driven by scroll position, not by a timer. One `MotionValue` per screen
 * runs 0 → 1 as that screen crosses the viewport, and every mark inside it is a
 * pure function of that one number — so the whole screen is a state machine
 * with scroll as its only input. Scroll back up and it plays backwards, stop
 * halfway and it holds there. A one-shot entrance cannot do any of that, and it
 * has a worse failure mode besides: it fires the moment the element clips the
 * viewport, which on this page is while the panel around it is still fading in,
 * so the motion is over before there is anything to watch.
 *
 * Each primitive encodes one specific thing rather than being a generic fade:
 *
 * - `Grow` — a bar rising from its baseline is a bucket of time filling up.
 * - `Draw` — a line traced left to right is a trend plotted in the order it
 *   happened, not a shape sliding in.
 * - `Sweep` — a bar extending from its own start is a duration elapsing, which
 *   is exactly what a waterfall row means.
 * - `Wipe` — a rule drawn downward is an annotation being placed.
 * - `Enter` — a row arriving from the leading edge is an event landing in a list.
 * - `Settle` — a card rising into place is a region of the page, not a queue item.
 * - `Ticker` — a number counting to its value is a live counter, the one figure
 *   on a dashboard that is genuinely always moving.
 *
 * All of them read the same clock, ease on the page's single curve, and resolve
 * to their finished state under `prefers-reduced-motion`.
 */

/* -------------------------------------------------------------------------- */
/* The clock                                                                   */
/* -------------------------------------------------------------------------- */

const StageContext = createContext<MotionValue<number> | null>(null);

/**
 * True while the surrounding screen has arrived and has not started leaving.
 *
 * The gate for every looping animation. Nothing loops outside this window: an
 * idle flourish on a screen you cannot see is a frame budget spent on nobody.
 */
const IdleContext = createContext(false);

/**
 * The surrounding screen's progress, 0 → 1.
 *
 * The fallback is a constant 1 rather than 0, so a primitive rendered outside a
 * stage shows its finished state instead of vanishing.
 */
export function useStageProgress(): MotionValue<number> {
  const fallback = useMotionValue(1);
  return useContext(StageContext) ?? fallback;
}

/** Whether looping animations should currently be running. */
export function useIdle(): boolean {
  return useContext(IdleContext);
}
/**
 * Derives the idle window: arrived, and still near enough to centre to watch.
 *
 * A boolean rather than a `MotionValue` because it gates whether loops run at
 * all, which is a mount-level decision — and it flips at most twice per pass,
 * so the re-render is free.
 */
export function useSettled(
  progress: MotionValue<number>,
  past: MotionValue<number>,
  enabled = true,
): boolean {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setSettled(false);
      return;
    }
    const sync = () =>
      setSettled(progress.get() >= SETTLED && past.get() <= PAST);
    sync();
    const stop = [progress.on('change', sync), past.on('change', sync)];
    return () => {
      for (const off of stop) off();
    };
  }, [enabled, progress, past]);

  return settled;
}

/** The page's easing curve, as a function of progress. */
const ease = cubicBezier(...EASE);

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * How much of the stage run one element's own move occupies.
 *
 * Long enough that each mark is legible on its own, short enough that a screen
 * with a dozen staggered slots still finishes while it is on screen.
 */
const SPAN = 0.34;

/** Nothing may start later than this, or it would never finish inside the run. */
const LAST_START = 1 - SPAN;

/**
 * Carves one element's window out of the stage's progress and eases it.
 *
 * `start` and the stagger step are fractions of the stage run, not seconds:
 * everything on these screens is positioned in scroll space, so there is no
 * clock to express a delay against.
 */
export function useSlot(start: number, span = SPAN): MotionValue<number> {
  const progress = useStageProgress();
  const from = clamp01(Math.min(start, LAST_START));
  const to = Math.min(from + span, 1);
  return useTransform(progress, (p) =>
    ease(clamp01((p - from) / (to - from || 1))),
  );
}

/**
 * There is deliberately no spring on the scroll input.
 *
 * Smoothing something that arrives already smoothed is the mistake: Lenis
 * exists to give the scroll a deceleration curve, and a spring in series with
 * it added about half a second of settling on top of Lenis' three hundred
 * milliseconds. Nearly a second between the wheel stopping and the page
 * finishing its response does not read as momentum, it reads as lag — a page
 * can hold 120fps and still feel heavy, and this is how.
 *
 * It would matter even if the feel were free. Motion runs scroll-linked
 * animations on the browser's native `ScrollTimeline`, fully accelerated with
 * no scroll measurement on the main thread, but only when the scroll value
 * reaches an accelerable style directly or through a single `useTransform`. A
 * spring in the middle is a JavaScript animation and takes everything
 * downstream off that path with it.
 */

export type StageMode = 'scroll' | 'enter';

/** Progress past which a screen counts as arrived, and idle may start. */
const SETTLED = 0.92;
/** How far past centre a screen may drift before its loops are shut off. */
const PAST = 0.06;

/**
 * The region whose travel through the viewport drives its own contents.
 *
 * Two phases, and deliberately only two:
 *
 * - **enter** — `start end` to `center center`: the screen fills in over its
 *   whole approach and is complete by the time it is the thing you are looking
 *   at. Because it is a scrub and not a one-shot, scrolling back up plays it
 *   backwards. That is the only "leaving" behaviour on this page, and it is not
 *   an exit — it is the entrance, read in reverse.
 * - **idle** — held while it is settled and on screen. This is the phase scroll
 *   cannot supply, so it is the only one on a clock: a dashboard whose every
 *   mark freezes the moment you stop scrolling is a screenshot with extra
 *   steps, and the whole reason these screens are real DOM is that they do not
 *   have to be one.
 *
 * There is **no exit phase**. Scrolling down past a screen leaves it exactly as
 * it was: a section that dims itself on the way out spends the reader's
 * attention twice, once to build the thing and once to take it away, and the
 * second spend buys nothing.
 *
 * The second scroll window below is therefore not a visual at all — nothing
 * reads it but the idle gate, which needs some way to know the screen has
 * drifted off centre so its loops can stop. Nothing off screen burns frames.
 *
 * `mode="enter"` exists for one case: the hero, which is already on screen at
 * first paint. Scrubbing that one would mean the dashboard is empty in the
 * first impression and only fills if you scroll, so it plays once instead —
 * `armed` is what holds it until the page has started.
 */
export function MockStage({
  children,
  className,
  mode = 'scroll',
  armed = true,
  delay = 0,
  gate,
  progress,
}: {
  children: ReactNode;
  className?: string;
  mode?: StageMode;
  armed?: boolean;
  /**
   * Holds a `mode="enter"` fill-in back by this many seconds.
   *
   * `armed` answers "is there a client alive to run this", which is not "is
   * there anything to see". The hero arms this screen at mount but does not
   * reveal the panel around it for two seconds, so an unheld fill-in plays out
   * behind an element at `opacity: 0` — and its sixty-odd motion values land on
   * the same frames as the background painting's reveal, which is where the
   * opening drops from 120fps to 64.
   */
  delay?: number;
  /**
   * An off-centre signal supplied from outside, purely to gate the idle loops.
   * The hero is pinned, so its box never travels through the viewport and a
   * measured one would read 0 forever — leaving its counters ticking long after
   * it had scrolled away.
   */
  gate?: MotionValue<number>;
  /**
   * The whole clock, supplied from outside, replacing the measured one.
   *
   * `gate` fixes the *idle* window for a surface that does not travel; this
   * fixes the entrance for the same case, which used to go unnoticed because it
   * happens off screen. A pinned surface measuring its own box reaches progress
   * 1 within a few hundred pixels of scroll, while the card carrying it is
   * still at 14% opacity and halfway through flying in — so it arrives already
   * finished, which is exactly what a screenshot looks like. Handed the same
   * progress that flies the card in, the two cannot disagree.
   */
  progress?: MotionValue<number>;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress: entering } = useScroll({
    target: ref,
    offset: ['start end', 'center center'],
  });
  const { scrollYProgress: passing } = useScroll({
    target: ref,
    offset: ['center center', 'end start'],
  });

  /*
    A cropped surface is bigger than the hole it is seen through, so its own
    box is the wrong thing to measure: the window in front of it publishes the
    clock instead, and it wins whenever there is one. Without this the rows in
    the lower half of a window finish arriving several hundred pixels of scroll
    after the reader has passed them, and the screen looks badly cropped rather
    than badly timed. See `window-progress.ts`.
  */
  const windowed = useContext(WindowProgressContext);
  const gated = useContext(StageGateContext);

  const played = useMotionValue(0);
  const settled = useMotionValue(1);
  const still = useMotionValue(0);

  useEffect(() => {
    if (reduced || mode !== 'enter' || !armed) return;
    const controls = animate(played, 1, { duration: 1.9, ease: EASE, delay });
    return () => controls.stop();
  }, [reduced, mode, armed, delay, played]);

  const measured = mode === 'enter' ? played : (windowed ?? entering);
  const clock = reduced ? settled : (progress ?? measured);
  const past = reduced ? still : (gate ?? gated ?? passing);

  const idle = useSettled(clock, past, !reduced);

  return (
    <StageContext.Provider value={clock}>
      <IdleContext.Provider value={idle}>
        {/*
          `select-none`, because these are pictures of the product rather than
          the product. They are built out of real elements, so a drag across one
          selects it like a document and a copy returns a column of issue titles
          that came from a fixture file — which is the moment the illusion goes.
          One place covers all of it: every screen and thumbnail on the page is
          rendered inside a `MockStage`.
        */}
        <div ref={ref} className={cn('h-full w-full select-none', className)}>
          {children}
        </div>
      </IdleContext.Provider>
    </StageContext.Provider>
  );
}

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

interface Slotted {
  /** Where this element's window opens, as a fraction of the stage run. */
  delay?: number;
  /** Position in a staggered group. */
  index?: number;
  /** Gap between consecutive members of the group, in stage fractions. */
  step?: number;
}

/** A row landing in a list, from the edge rows arrive from. */
export function Enter({
  index = 0,
  delay = 0,
  step = 0.055,
  className,
  children,
}: Slotted & { className?: string; children: ReactNode }) {
  const p = useSlot(delay + index * step);
  const opacity = useTransform(p, [0, 0.55], [0, 1]);
  const x = useTransform(p, [0, 1], [-12, 0]);

  return (
    <m.div className={className} style={{ opacity, x }}>
      {children}
    </m.div>
  );
}

/** A tile settling into place. Rises: a card is a region, not a queue item. */
export function Settle({
  index = 0,
  delay = 0,
  step = 0.07,
  className,
  children,
}: Slotted & { className?: string; children: ReactNode }) {
  const p = useSlot(delay + index * step);
  const opacity = useTransform(p, [0, 0.5], [0, 1]);
  const y = useTransform(p, [0, 1], [18, 0]);

  return (
    <m.div className={className} style={{ opacity, y }}>
      {children}
    </m.div>
  );
}

/**
 * A mark growing from its baseline: one bucket of a bar chart filling up.
 *
 * `origin` is given in the SVG's own units, because a percentage transform
 * origin on an SVG child resolves against the whole viewBox, not the element.
 */
export function Grow({
  index = 0,
  delay = 0,
  step = 0.02,
  origin,
  children,
}: Slotted & { origin: string; children: ReactNode }) {
  const scaleY = useSlot(delay + index * step);
  return <m.g style={{ transformOrigin: origin, scaleY }}>{children}</m.g>;
}

/**
 * A bar extending from its own start: a duration elapsing.
 *
 * The waterfall derives each row's `delay` from where its span begins in the
 * trace, so scrolling the section replays the run in the order it happened.
 */
export function Sweep({
  delay = 0,
  span,
  className,
  style,
}: {
  delay?: number;
  span?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const scaleX = useSlot(delay, span);
  return (
    <m.span
      className={className}
      style={{ ...style, transformOrigin: 'left center', scaleX }}
    />
  );
}

/**
 * `Grow` for an HTML element: a bar rising off its baseline.
 *
 * Separate from `Grow` because that one emits an SVG `<g>` and takes its origin
 * in viewBox units; here a CSS percentage origin means what it says.
 */
export function Rise({
  delay = 0,
  className,
  style,
}: {
  delay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const scaleY = useSlot(delay);
  return (
    <m.span
      className={className}
      style={{ ...style, transformOrigin: 'bottom center', scaleY }}
    />
  );
}

/** A rule drawn downward: an annotation being placed against something. */
export function Wipe({
  delay = 0,
  className,
  style,
}: {
  delay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const scaleY = useSlot(delay, 0.22);
  return (
    <m.span
      className={className}
      style={{ ...style, transformOrigin: 'top center', scaleY }}
    />
  );
}

/**
 * A line traced from its first point to its last.
 *
 * `pathLength` animates the dash offset natively, so this is one interpolated
 * attribute on one element rather than a per-frame path rebuild.
 */
export function Draw({
  delay = 0,
  span = 0.55,
  ...path
}: Pick<
  SVGProps<SVGPathElement>,
  'd' | 'fill' | 'stroke' | 'strokeWidth' | 'strokeLinecap' | 'strokeLinejoin'
> & { delay?: number; span?: number }) {
  const pathLength = useSlot(delay, span);
  return <m.path {...path} style={{ pathLength }} />;
}

/** The wash under a drawn line. Fades in behind it rather than being traced. */
export function Wash({
  delay = 0.25,
  children,
}: {
  delay?: number;
  children: ReactNode;
}) {
  const opacity = useSlot(delay, 0.45);
  return <m.g style={{ opacity }}>{children}</m.g>;
}

/**
 * A counter running up to its value.
 *
 * The formatter is what keeps this honest: the number is driven as a raw count
 * and formatted on every frame, so a value that displays as `18.2k` counts
 * through `4.1k`, `11.7k` and lands on `18.2k` — rather than the digits of the
 * final string scrambling, which reads as a slot machine and says nothing.
 */
/**
 * The default counter format, built once.
 *
 * `Number.prototype.toLocaleString` constructs a formatter on every call, and
 * this one is called from inside a `useTransform` — several times a frame,
 * across six counters, for as long as any of them is on screen. Hoisting it is
 * the whole fix; the formatting itself is not the expensive part.
 */
const PLAIN = new Intl.NumberFormat('en-US');

export function Ticker({
  value,
  format = (n) => PLAIN.format(Math.round(n)),
  delay = 0,
  live = 0,
  beat = 0,
  beatBy = 0,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  delay?: number;
  /**
   * Units gained per second once the counter has landed and the screen is idle.
   *
   * This is the honest version of "keep it moving": the figure does not reset
   * or loop, it accrues — because the thing it stands for is a total that only
   * goes up. Scaled by the entry progress so it contributes nothing until the
   * count-up has finished.
   */
  live?: number;
  /**
   * How many discrete arrivals have landed so far. Where `live` is the trickle
   * nobody is meant to catch, this is the jump they are meant to: the hero's
   * scene lands one event at a time, and the counter has to visibly answer.
   */
  beat?: number;
  /** Units added per arrival. */
  beatBy?: number;
  className?: string;
}) {
  const p = useSlot(delay, 0.55);
  const gained = useMotionValue(0);
  const stepped = useMotionValue(0);
  const idle = useIdle();

  useEffect(() => {
    if (!idle || live <= 0) return;
    // A long linear accrual rather than a repeating loop: a counter that
    // rewound would be a lie about what a counter is.
    const controls = animate(gained, gained.get() + live * 900, {
      duration: 900,
      ease: 'linear',
    });
    return () => controls.stop();
  }, [idle, live, gained]);

  // Driven off the running total rather than incremented, so a beat missed
  // while the screen was off centre is caught up on rather than lost.
  useEffect(() => {
    if (beatBy <= 0) return;
    const controls = animate(stepped, beat * beatBy, {
      duration: 1.1,
      ease: EASE,
    });
    return () => controls.stop();
  }, [beat, beatBy, stepped]);

  const text = useTransform([p, gained, stepped], ([t, g, s]: number[]) =>
    format(t * (value + g + s)),
  );
  return <m.span className={className}>{text}</m.span>;
}

/* -------------------------------------------------------------------------- */
/* Idle                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The bucket that is still filling.
 *
 * Applied to the newest mark of a time series and nothing else, because that is
 * the only one whose value is genuinely still moving. Breathing every bar would
 * be a shimmer effect; breathing the last one is a statement about what the
 * chart is showing.
 */
export function Breath({
  origin,
  amount = 0.07,
  duration = 3.6,
  children,
}: {
  origin: string;
  amount?: number;
  duration?: number;
  children: ReactNode;
}) {
  const idle = useIdle();
  const reduced = useReducedMotion();

  if (reduced) {
    return <g>{children}</g>;
  }

  return (
    <m.g
      style={{ transformOrigin: origin }}
      animate={idle ? { scaleY: [1, 1 + amount, 1] } : { scaleY: 1 }}
      transition={
        idle
          ? { duration, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }
          : { duration: 0.4, ease: EASE }
      }
    >
      {children}
    </m.g>
  );
}

/**
 * A mark that steps up when something lands on it, and never steps back down.
 *
 * `Breath` says "this bucket is still filling" as a mood; this says it as a
 * fact, because the growth is caused by an arrival the reader has just watched
 * cross the screen. Composes with `Breath` and with `Grow` — all three scale on
 * the same baseline origin, so nesting them multiplies rather than fights.
 *
 * Capped by the caller, and it has to be: a bar that grows on every loop would
 * eventually leave the plot, and a chart that outgrows its own axis is a worse
 * lie than a chart that never moves.
 */
export function StepGrow({
  origin,
  amount,
  children,
}: {
  origin: string;
  /** Total growth so far, as a fraction of the mark's height. */
  amount: number;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const scaleY = useMotionValue(1);

  useEffect(() => {
    if (reduced) return;
    const controls = animate(scaleY, 1 + amount, { duration: 1.1, ease: EASE });
    return () => controls.stop();
  }, [amount, reduced, scaleY]);

  return <m.g style={{ transformOrigin: origin, scaleY }}>{children}</m.g>;
}

/**
 * The mark left on a surface that just changed: a ring in the accent, fading.
 *
 * A number that jumps is easy to miss on a dashboard with sixty other marks on
 * it. This is what makes the change findable without making it loud — it is
 * gone in just over a second, and it only ever fires on something the reader
 * has a reason to look at.
 *
 * One opacity on one element, and it is keyed on the arrival so it restarts
 * rather than queueing. The parent has to be positioned.
 *
 * A border rather than a ring, and that is not a style choice: the card this
 * sits in clips its own overflow, and a ring is drawn *outside* the box it is
 * on — an `inset-0` ring would be cropped away on all four sides by the parent
 * it is meant to outline.
 */
export function Flash({ run }: { run: number }) {
  const reduced = useReducedMotion();

  if (reduced || run <= 0) {
    return null;
  }

  return (
    <m.span
      key={run}
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-xl border border-primary/60"
      initial={{ opacity: 0.85 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 1.3, ease: 'easeOut' }}
    />
  );
}
/**
 * A specular sweep across a surface: light moving over a screen.
 *
 * The one idle effect here that is not saying something about the data, and it
 * earns its place a different way — it is what tells you the panel is a
 * *surface* rather than a picture pasted onto the page. Kept honest by being
 * barely there (a 5% white band) and mostly absent (seven seconds of travel,
 * eight seconds of nothing), because a sheen you notice on a loop is a novelty
 * and a sheen you only catch is a material.
 *
 * The band is a percentage of the surface and travels on `x`, so the whole
 * effect is one composited transform on one element.
 */
export function Sheen({
  duration = 7,
  gap = 8,
  className,
}: {
  duration?: number;
  gap?: number;
  className?: string;
}) {
  const idle = useIdle();
  const reduced = useReducedMotion();

  if (reduced || !idle) {
    return null;
  }

  return (
    <m.span
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-y-[-30%] left-0 w-[45%] -skew-x-12',
        className,
      )}
      style={{
        background:
          'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
      }}
      animate={{ x: ['-130%', '265%'] }}
      transition={{
        duration,
        repeat: Number.POSITIVE_INFINITY,
        repeatDelay: gap,
        ease: [0.4, 0, 0.6, 1],
      }}
    />
  );
}

/**
 * A soft halo breathing on the newest point of a series.
 *
 * Where `Breath` says "this bar is still filling", this says "this is the
 * current value" — the end of a line has no width to grow, so it gets a pulse
 * instead. Two rings out of phase so the falloff reads as light rather than as
 * a resizing circle.
 */
export function Pulse({
  cx,
  cy,
  color,
  r = 3,
}: {
  cx: number;
  cy: number;
  color: string;
  r?: number;
}) {
  const idle = useIdle();
  const reduced = useReducedMotion();
  const opacity = useSlot(0.55, 0.2);

  return (
    <m.g style={{ opacity }}>
      {!reduced && idle
        ? [0, 1.4].map((offset) => (
            <m.circle
              key={offset}
              cx={cx}
              cy={cy}
              r={r}
              fill={color}
              animate={{ scale: [1, 3.4], opacity: [0.45, 0] }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
              transition={{
                duration: 2.8,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'easeOut',
                delay: offset,
              }}
            />
          ))
        : null}
      <circle cx={cx} cy={cy} r={r} fill={color} />
    </m.g>
  );
}
/**
 * The slow breath on a live indicator.
 *
 * Not gated on `idle`, and deliberately: its meaning *is* ongoing, so a tail
 * that stopped pulsing whenever its screen drifted off centre would read as a
 * stream that stalls. That argument holds for the idle window and only for the
 * idle window — it says nothing about a beacon that has scrolled clean off the
 * page, which is what the viewport gate covers instead.
 *
 * The gate is not about this one element's cost, which is negligible. It is
 * about the frame loop: Motion's scheduler only sleeps when *nothing* is
 * animating, so a single `repeat: Infinity` anywhere on the page keeps the
 * whole pipeline ticking for as long as the tab is open. Two of these were
 * mounted permanently.
 */
export function Beacon({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const box = useRef<HTMLSpanElement>(null);
  const onScreen = useOnScreen(box);

  if (reduced) {
    return <span className={cn('size-1.5 rounded-full', className)} />;
  }

  return (
    <span
      ref={box}
      className="relative grid size-1.5 shrink-0 place-items-center"
    >
      {onScreen ? (
        <m.span
          className={cn('absolute inset-0 rounded-full', className)}
          animate={{ scale: [1, 2.6, 2.6], opacity: [0.5, 0, 0] }}
          transition={{
            duration: 2.2,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeOut',
          }}
        />
      ) : null}
      <span className={cn('relative size-1.5 rounded-full', className)} />
    </span>
  );
}

/**
 * Advances an index on a fixed interval while the screen is idle.
 *
 * The backbone of the log tail: a stream that only moves when you scroll is not
 * a stream. Holds its position when the screen is not being looked at, so
 * coming back to it does not reveal a jump.
 */
export function useIdleStep(period: number, length: number): number {
  const idle = useIdle();
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!idle || reduced || length <= 0) return;
    const id = setInterval(() => setStep((n) => (n + 1) % length), period);
    return () => clearInterval(id);
  }, [idle, reduced, period, length]);

  return step;
}
