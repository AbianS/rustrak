'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useOnScreen } from '../use-on-screen';

/**
 * A phrase that types itself, holds, deletes, and types the next one.
 *
 * Used for the last few words of the headline, which is the only place on the
 * page where a claim can be swapped without rewriting the sentence around it:
 * the stem stays put and the ending changes, so the reader gets four arguments
 * for the price of one line.
 *
 * Timing is deliberately asymmetric — deleting is roughly twice as fast as
 * typing. That is how a person actually retypes a word, and an even rate reads
 * mechanical.
 *
 * The animated text is `aria-hidden` and the full first sentence is exposed to
 * assistive tech instead. A live region that retyped itself every four seconds
 * would be hostile, and the rotation is emphasis rather than content — every
 * phrase says the same thing about the product.
 *
 * ── It stops when nobody is reading it ──────────────────────────────────────
 *
 * The clock is gated on the phrase being on screen, and that is not a small
 * saving. Typing is a `setState` every 62ms and deleting one every 28ms, which
 * is a React commit roughly sixteen times a second — and it used to keep going
 * for as long as the tab was open, from five screens further down the page.
 *
 * Worse than the commits was what they landed on. The headline is set with
 * `text-wrap: balance`, and balancing re-runs the line-breaking algorithm on
 * every change to the text inside it. A phrase that changes width sixteen times
 * a second inside a balanced block is a permanent reflow of the tallest element
 * on the page. (The stem now carries `text-balance` on its own line, so the
 * rotator is outside the balanced box as well — belt and braces.)
 */

/** Milliseconds per character while typing. */
const TYPE = 62;
/** Milliseconds per character while deleting. */
const DELETE = 28;
/** How long a completed phrase stays up. */
const HOLD = 2400;
/** Beat between deleting one phrase and starting the next. */
const BETWEEN = 320;

type Phase = 'typing' | 'holding' | 'deleting';

export function Typewriter({
  phrases,
  active = true,
  className,
  caretClassName,
}: {
  phrases: readonly string[];
  /** Held false until whatever should precede this has finished. */
  active?: boolean;
  className?: string;
  caretClassName?: string;
}) {
  const reduced = useReducedMotion();
  const box = useRef<HTMLSpanElement>(null);
  // Not `once`: the point is to stop again on the way out, not only to start.
  // The margin restarts the clock a screenful early, so the phrase is already
  // mid-word when it comes into view rather than sitting frozen for a beat.
  const onScreen = useOnScreen(box, { rootMargin: '400px' });
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<Phase>('typing');

  const phrase = phrases[index % phrases.length];
  const running = active && onScreen && !reduced;

  useEffect(() => {
    if (!running) return;

    if (phase === 'typing') {
      if (count < phrase.length) {
        const id = setTimeout(() => setCount((n) => n + 1), TYPE);
        return () => clearTimeout(id);
      }
      const id = setTimeout(() => setPhase('holding'), 0);
      return () => clearTimeout(id);
    }

    if (phase === 'holding') {
      const id = setTimeout(() => setPhase('deleting'), HOLD);
      return () => clearTimeout(id);
    }

    if (count > 0) {
      const id = setTimeout(() => setCount((n) => n - 1), DELETE);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => {
      setIndex((n) => (n + 1) % phrases.length);
      setPhase('typing');
    }, BETWEEN);
    return () => clearTimeout(id);
  }, [running, phase, count, phrase.length, phrases.length]);

  const shown = reduced ? phrases[0] : phrase.slice(0, count);

  return (
    <>
      {/* The sentence as a reader of the page should receive it: one claim,
          stated once. */}
      <span className="sr-only">{phrases[0]}</span>

      <span
        ref={box}
        aria-hidden
        className={cn('whitespace-nowrap', className)}
      >
        {shown}
        {reduced ? null : (
          <Caret
            // Blinks only while the phrase is standing still. A caret that
            // blinks mid-word fights the typing it is supposed to be doing —
            // and only while it is on screen, since an infinite repeat is what
            // keeps Motion's frame loop from ever going quiet.
            blinking={running && phase === 'holding'}
            className={caretClassName}
          />
        )}
      </span>
    </>
  );
}

function Caret({
  blinking,
  className,
}: {
  blinking: boolean;
  className?: string;
}) {
  return (
    <motion.span
      className={cn(
        'ml-[0.06em] inline-block w-[0.06em] translate-y-[0.06em] self-stretch bg-current align-baseline',
        className,
      )}
      style={{ height: '0.82em' }}
      animate={blinking ? { opacity: [1, 1, 0, 0] } : { opacity: 1 }}
      transition={
        blinking
          ? {
              duration: 1.06,
              times: [0, 0.5, 0.5, 1],
              repeat: Number.POSITIVE_INFINITY,
              ease: 'linear',
            }
          : { duration: 0.1 }
      }
    />
  );
}
