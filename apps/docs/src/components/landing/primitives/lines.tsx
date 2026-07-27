'use client';

import { motion, useReducedMotion } from 'motion/react';
import { type ReactNode, useRef } from 'react';
import { DUR, EASE } from '../motion';
import { useRevealed } from '../use-on-screen';

interface LinesProps {
  /** One entry per visual line; each is masked and rises independently. */
  lines: ReactNode[];
  className?: string;
  /** Rendered as `h1` on the hero, `h2` everywhere else. */
  as?: 'h1' | 'h2';
  delay?: number;
  /**
   * Drives the animation from a parent instead of the viewport. The hero uses
   * it to wait for the page to start; everything else leaves it undefined and reveals
   * when scrolled into view.
   */
  active?: boolean;
}

const LINE_VARIANTS = {
  hidden: { y: '112%', rotate: 2.5, opacity: 0 },
  visible: { y: '0%', rotate: 0, opacity: 1 },
};

/**
 * Headline whose lines are uncovered from below, one after the other, with a
 * slight rotation so they swing up rather than slide. The clipping element
 * carries vertical padding pulled back by a negative margin: without it
 * `overflow: hidden` shears the descenders and the italic serif's overhang.
 *
 * Uncontrolled instances trigger off a hand-rolled IntersectionObserver, for
 * the same reason `Reveal` does — motion's own viewport trigger proved
 * unreliable for elements low on this smooth-scrolled page.
 */
export function Lines({
  lines,
  className,
  as: Tag = 'h2',
  delay = 0,
  active,
}: LinesProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLHeadingElement>(null);
  const shown = useRevealed(ref, active, {
    threshold: 0.2,
    rootMargin: '0px 0px -8% 0px',
  });

  if (reduced) {
    return (
      <Tag ref={ref} className={className}>
        {lines.map((line, index) => (
          <span key={index} className="block">
            {line}
          </span>
        ))}
      </Tag>
    );
  }

  return (
    <Tag ref={ref} className={className}>
      {lines.map((line, index) => (
        <span
          // Headline lines are a fixed authored list, never reordered.
          key={index}
          className="block overflow-hidden py-[0.14em] my-[-0.14em]"
        >
          <motion.span
            className="block origin-bottom-left"
            initial="hidden"
            animate={shown ? 'visible' : 'hidden'}
            variants={LINE_VARIANTS}
            transition={{
              duration: DUR.slow,
              ease: EASE,
              delay: delay + index * 0.09,
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}
