'use client';

import {
  AnimatePresence,
  animate,
  type MotionValue,
  useMotionValue,
  useReducedMotion,
} from 'motion/react';
import * as m from 'motion/react-m';
import { type ReactNode, useEffect, useState } from 'react';
import { EASE } from '../motion';
import { AppFrame } from './app-frame';
import { Cursor } from './cursor';
import { type Point, PRESS, travelTime } from './cursor-motion';
import { EventScene } from './event-scene';
import { MockAgents } from './mock-agents';
import { MockIssueDetail } from './mock-issue-detail';
import { MockIssues } from './mock-issues';
import { MockLogs } from './mock-logs';
import { MockOverview } from './mock-overview';
import { CARET_RETURN, POINTER_BIRTH, POINTER_FLIGHT } from './pointer-origin';
import { StageGateContext, WindowProgressContext } from './window-progress';

/**
 * The product, being used.
 *
 * The caret at the end of the headline unfolds into a pointer, drifts into the
 * panel, clicks the rail, and the page under it changes. Five screens, so the
 * claim is not "there is a dashboard" but "there are issues, a stack trace, a
 * log stream and an agent waterfall", made inside the first screenful without
 * the reader scrolling or clicking anything. The screens are the ones the
 * platform section draws further down; nothing here was built for the hero.
 *
 * Every screen plays and then lives. Each arrival gets a fresh clock animated
 * 0 → 1, published where `MockStage` will find it, so the screen runs its real
 * entrance and spends what is left of its time idling — the log tail advancing,
 * counters accruing — which is the half that only works because these are
 * components rather than images. Neither half runs on its own here: a pinned
 * panel never travels through the viewport, so a stage measuring its own box
 * reads a finished entrance and a screen long past centre from the first frame.
 * The two contexts published below are the fix.
 *
 * Two speeds, on purpose. The pointer moves slowly, because that is the part
 * asking to be watched; the screens, once clicked, are brisk, because a reader
 * at the top of a landing page does not know anything is coming and a stop that
 * takes six seconds is one most people scroll past the middle of. Dwell is per
 * screen rather than uniform — a stack trace and a segmented list do not take
 * the same time to recognise.
 *
 * The tour owns the `AppFrame` rather than sitting inside one, because the
 * frame hides its overflow and the pointer spends the first two and a half
 * seconds of its life above the panel. Inside, it would be cropped away until
 * the exact moment it arrived, which is the moment it stops being interesting.
 */

interface Stop {
  id: string;
  node: ReactNode;
  /**
   * The control that is clicked to *get* to this screen, in the app's design
   * pixels. Rail items are read off `MockShell`: a 64px header, 8px of rail
   * padding, the project switcher, a 32px section label, then 40px rows with
   * 6px between them.
   */
  target: Point;
  /** Seconds held after the screen has arrived, before the pointer sets off. */
  dwell: number;
}

const STOPS: Stop[] = [
  {
    id: 'overview',
    node: <MockOverview />,
    target: { x: 62, y: 186 },
    dwell: 2.4,
  },
  { id: 'issues', node: <MockIssues />, target: { x: 62, y: 232 }, dwell: 1.9 },
  {
    id: 'detail',
    // Reached from the list rather than from the rail, which is the honest
    // route and the one moment the pointer leaves the navigation: the first row
    // of the issue table, over its title.
    node: <MockIssueDetail />,
    target: { x: 440, y: 312 },
    dwell: 2.4,
  },
  { id: 'logs', node: <MockLogs />, target: { x: 62, y: 416 }, dwell: 2 },
  { id: 'agents', node: <MockAgents />, target: { x: 62, y: 370 }, dwell: 2 },
];

/**
 * The order the screens are visited in, forever.
 *
 * The pointer is born at the headline's caret once and never goes back — each
 * pass picks up where the last left it, so the only thing that happens twice is
 * a hop between two controls. Returning to the origin replays the descent every
 * twenty seconds, which turns the one gesture worth watching into a tic and
 * strands the pointer up in the type while the panel sits still underneath.
 *
 * Starts at 1 because 0 is already on screen when the pointer arrives: the
 * first thing it does is take the reader somewhere new.
 */
const ROUTE = [1, 2, 3, 4, 0];

/**
 * How long each hop takes, worked out once.
 *
 * Every target is a constant, so every distance is too. `LEGS[i]` is the time
 * from the previous stop in the cycle to this one, which wraps — the hop into
 * the first entry comes from the last, because after a full pass that is where
 * the pointer is standing. The single exception is the very first descent, and
 * the component handles that one by name.
 */
const LEGS: number[] = ROUTE.map((dest, index) =>
  travelTime(
    STOPS[ROUTE[(index - 1 + ROUTE.length) % ROUTE.length]].target,
    STOPS[dest].target,
  ),
);

/**
 * How long a screen takes to fill in.
 *
 * Shorter than the 1.9s the panel's own entrance uses. That one arrives into
 * empty space and can afford to linger; this one has about two seconds before
 * the pointer moves again, and an entrance still finishing when the next hop
 * starts reads as the page struggling to keep up.
 */
const PLAY = 1.05;

/** The cross-fade between two screens. Just longer than the press. */
const SWAP = 0.3;

/**
 * How long the opening screen waits before it fills in.
 *
 * It is mounted at first paint, behind a panel that is at `opacity: 0` until 2s
 * — so left to itself its entrance played out where nobody could see it and
 * finished at the exact moment the panel began to appear. The visitor got a
 * complete, static dashboard fading in.
 *
 * Only the opening screen needs it. Every screen after arrives on a click, into
 * a window that is already there.
 */
const OPEN_DELAY = 2.3;

/**
 * The gap between the press landing and the screen changing.
 *
 * Not zero, and not tuned by eye: a control that reacts on the same frame the
 * mouse goes down reads as a video that was cut there. A beat of delay is what
 * a real click feels like.
 */
const REACT = 0.09;

/**
 * One screen, with its own clock.
 *
 * Per-mount rather than shared, which is what makes the cross-fade clean: the
 * screen on its way out holds the state it had, instead of rewinding to zero as
 * the incoming screen's entrance starts.
 */
function Stage({
  gate,
  delay = 0,
  children,
}: {
  gate: MotionValue<number>;
  delay?: number;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const play = useMotionValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    const controls = animate(play, 1, { duration: PLAY, ease: EASE, delay });
    return () => controls.stop();
  }, [play, reduced, delay]);

  return (
    <WindowProgressContext.Provider value={play}>
      <StageGateContext.Provider value={gate}>
        {children}
      </StageGateContext.Provider>
    </WindowProgressContext.Provider>
  );
}

export function Tour({
  armed,
  gate,
  onCaret,
}: {
  /** Held until the client is alive and the panel has begun to appear. */
  armed: boolean;
  /** The hero's own on-screen signal. Pinned panels cannot measure their own. */
  gate: MotionValue<number>;
  /**
   * Whether the pointer currently has the headline's caret.
   *
   * True on the frame the bar leaves the line, false again a few seconds later
   * once the pointer is down in the panel and the headline can quietly fade a
   * caret back in. It is only ever rung twice in the life of the page.
   */
  onCaret: (away: boolean) => void;
}) {
  const reduced = useReducedMotion();
  const running = armed && !reduced;

  /** The screen being shown. */
  const [at, setAt] = useState(0);
  const [pressed, setPressed] = useState(false);

  /*
    Hops completed, counting up forever. Below zero the pointer is still in the
    headline.

    A monotonic counter rather than an index that wraps, plus a flag for whether
    the descent has happened, and the difference is not stylistic — the pair of
    them was a bug. `born` was state, so it was in this effect's dependencies,
    so setting it re-ran the effect and the cleanup cancelled every timer the
    current leg had in flight. One of those was the one that gives the caret
    back, three seconds out against a descent of two and a half, so it was
    always cancelled a beat before it fired and the headline never got its caret
    again. The others were the press and the screen change, which were then
    rescheduled a whole travel late.

    Derived from one number, none of that can happen: there is nothing to set,
    so there is nothing to re-run on.
  */
  const [step, setStep] = useState(-1);
  const leg = step < 0 ? -1 : step % ROUTE.length;
  const first = step === 0;

  useEffect(() => {
    if (!running) return;

    // Still up in the headline: wait, then take the caret and set off.
    if (step < 0) {
      const id = setTimeout(() => {
        onCaret(true);
        setStep(0);
      }, POINTER_BIRTH * 1000);
      return () => clearTimeout(id);
    }

    const dest = ROUTE[leg];
    // The first hop is the descent, which starts outside the panel and so has
    // no previous stop to be measured from.
    const travel = first ? POINTER_FLIGHT : LEGS[leg];

    const timers = [
      setTimeout(() => setPressed(true), travel * 1000),
      setTimeout(() => setPressed(false), (travel + PRESS) * 1000),
      setTimeout(() => setAt(dest), (travel + REACT) * 1000),
      setTimeout(
        () => setStep((n) => n + 1),
        (travel + STOPS[dest].dwell) * 1000,
      ),
    ];

    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [running, step, leg, first, onCaret]);

  /*
    The headline gets its caret back on a plain fade, once, a few seconds after
    the pointer took it. See `pointer-origin.ts`.

    On its own effect deliberately. It is the only thing on this component whose
    timer has to outlive a leg change, and living in the chain above is exactly
    what got it cancelled: `launched` goes false to true once and never moves
    again, so this runs once and nothing clears it.
  */
  const launched = step >= 0;

  useEffect(() => {
    if (!launched) return;
    const id = setTimeout(() => onCaret(false), CARET_RETURN * 1000);
    return () => clearTimeout(id);
  }, [launched, onCaret]);

  const screen = STOPS[at];

  return (
    <div className="relative">
      <AppFrame>
        {/*
          Traffic landing on the overview while the panel is up. It wraps the
          whole tour rather than the one screen, because the counts have to keep
          running while the other screens are shown or coming back to the
          overview would find it exactly where it was left.
        */}
        <EventScene active={running}>
          <div className="relative h-full w-full">
            <AnimatePresence initial={false}>
              <m.div
                key={screen.id}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: SWAP, ease: EASE }}
              >
                {/* Only the opening screen waits for the panel to appear around
                    it. Every screen after arrives on a click, into a window
                    that is already there. */}
                <Stage gate={gate} delay={step < 1 ? OPEN_DELAY : 0}>
                  {screen.node}
                </Stage>
              </m.div>
            </AnimatePresence>
          </div>
        </EventScene>
      </AppFrame>

      {/*
        Mounted from the frame it leaves the headline and never unmounted: its
        birth is an `initial`, and an `initial` only happens once.

        Which is why the gate is `leg`, not `running`. `running` follows the
        panel's visibility, so it had been unmounting the pointer whenever the
        reader scrolled the hero away — and scrolling back mounted a fresh one,
        which ran the morph again and started the descent again from a caret in
        a headline it had left minutes earlier. The timers above are already
        held by `running`; the pointer only has to stay where it was.
      */}
      {leg >= 0 ? (
        <Cursor
          at={STOPS[ROUTE[leg]].target}
          pressed={pressed}
          duration={first ? POINTER_FLIGHT : LEGS[leg]}
        />
      ) : null}
    </div>
  );
}
