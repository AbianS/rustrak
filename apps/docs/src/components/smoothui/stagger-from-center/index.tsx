'use client';

import { motion, useInView, useReducedMotion } from 'motion/react';
import { useRef } from 'react';

export interface StaggerFromCenterProps {
  children: string;
  className?: string;
  /** Delay before the animation starts, in milliseconds. */
  delay?: number;
  /** Per-step stagger between characters, in milliseconds. */
  stagger?: number;
  /** Animate only once the text scrolls into view. */
  triggerOnView?: boolean;
}

const DURATION_S = 0.62;
const MS = 1000;
// Apple-ish ease-out for center-out reveal.
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * StaggerFromCenter — characters reveal from the center outward to
 * emphasize the keyword core. Delay is computed by distance from center,
 * not linear index. From the animate-text catalog (`stagger-from-center`).
 *
 * ── Diverges from upstream: no per-character blur ───────────────────────────
 *
 * The catalog version animates `filter: blur(3px) → blur(0px)` alongside the
 * fade. That is one composited layer *per character*, and the hero sets two
 * blocks of text this way — about 130 glyphs, every one of them running a
 * gaussian blur simultaneously, during the same second the page is hydrating
 * and the background canvas is resolving. It was the single most expensive
 * thing on the page and the first thing a visitor's machine had to survive.
 *
 * It also bought very little: at 0.62s per glyph on a 3px radius, what reads is
 * the stagger and the rise, not the focus pull. Dropping it leaves `opacity`
 * and `y`, both of which the compositor handles without touching the main
 * thread. If a focus pull is ever wanted back, it belongs on the line as a
 * whole — one element, one layer — never on the characters.
 */
export default function StaggerFromCenter({
  children,
  className = '',
  delay = 0,
  stagger = 22,
  triggerOnView = false,
}: StaggerFromCenterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const shouldReduceMotion = useReducedMotion();
  const play = (!triggerOnView || inView) && !shouldReduceMotion;
  const characters = Array.from(children);
  const center = (characters.length - 1) / 2;

  return (
    <span aria-label={children} className={className} ref={ref}>
      {characters.map((char, index) => {
        const distance = Math.abs(index - center);
        return (
          <motion.span
            animate={play ? { opacity: 1, y: 0 } : undefined}
            aria-hidden="true"
            initial={
              shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }
            }
            // biome-ignore lint/suspicious/noArrayIndexKey: characters have no stable id
            key={index}
            style={{ display: 'inline-block', whiteSpace: 'pre' }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : {
                    duration: DURATION_S,
                    delay: delay / MS + (distance * stagger) / MS,
                    ease: EASE,
                  }
            }
          >
            {char === ' ' ? ' ' : char}
          </motion.span>
        );
      })}
    </span>
  );
}
