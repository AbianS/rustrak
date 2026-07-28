'use client';

import {
  type MotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import * as m from 'motion/react-m';
import { type ReactNode, useRef } from 'react';
import { cn } from '@/lib/utils';
import { DUR, EASE } from '../motion';
import { useRevealed } from '../use-on-screen';

/**
 * A pill label. Small, tinted, sitting above its heading — the marker that
 * tells you which chapter of the page you are in.
 */
export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-primary/12 px-2.5 py-1 text-[12.5px] font-medium text-primary">
      {children}
    </span>
  );
}

/**
 * One word of a scrubbed heading. A ghost sits in the flow and the lit copy is
 * laid over it, so the line never reflows as it fills in.
 *
 * Adapted from smoothui's `scroll-reveal-paragraph`, which lights every word to
 * the same colour. That would flatten the two-tone treatment this page is built
 * on, so the final colour is passed in per word instead: the claim lands in
 * foreground, its continuation in muted. Only this adaptation is kept; the
 * upstream component itself was never used on the page.
 */
function Word({
  children,
  progress,
  range,
  tone,
}: {
  children: string;
  progress: MotionValue<number>;
  range: [number, number];
  tone: string;
}) {
  const opacity = useTransform(progress, range, [0, 1]);

  return (
    <span className="relative mr-[0.25em] inline-block">
      {/*
        Every word is painted twice: dim and in flow to hold the space, lit and
        absolutely positioned on top, so the line never reflows as it fills in.

        The in-flow copy is the authoritative one — it is what a screen reader
        announces and what a selection picks up, which is why the overlay above
        it carries both `aria-hidden` and `select-none`. `aria-hidden` alone
        does nothing to the clipboard: copying a scrubbed heading gave every
        word twice ("ThankThankyou.you.") until the overlay was excluded from
        selection too. Authority sits on the in-flow copy rather than the
        overlay because an out-of-flow element is an unreliable selection
        target, and an ordinary inline box always is.
      */}
      <span className="text-foreground/12">{children}</span>
      <m.span
        aria-hidden
        className={cn('absolute inset-0 select-none', tone)}
        style={{ opacity }}
      >
        {children}
      </m.span>
    </span>
  );
}

/**
 * Fills a heading in word by word as it rises through the viewport.
 *
 * Reserved for the standalone statements in the lower half of the page, where
 * a section is one sentence and there is nothing else competing for the eye.
 * It is deliberately not used on the hero or on the platform chapters: on the
 * hero it would delay the one line that has to land immediately, and repeated
 * across twelve chapter headings it stops being an effect and becomes a tic.
 */
function ScrubbedHeading({
  lead,
  rest,
  className,
  as: Tag = 'h2',
}: {
  lead: string;
  rest?: string;
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.9', 'start 0.35'],
  });

  const leadWords = lead.split(' ');
  const restWords = rest ? rest.split(' ') : [];
  const total = leadWords.length + restWords.length;

  const render = (word: string, index: number, tone: string) => {
    const start = index / total;
    return (
      // react-doctor-disable-next-line react-doctor/no-array-index-as-key
      <Word
        // Words split from an authored headline: fixed length, fixed order.
        key={`${index}-${word}`}
        progress={scrollYProgress}
        range={[start, start + 1 / total]}
        tone={tone}
      >
        {word}
      </Word>
    );
  };

  return (
    <Tag ref={ref} className={cn('text-balance', className)}>
      {leadWords.map((word, index) => render(word, index, 'text-foreground'))}
      {restWords.map((word, index) =>
        render(word, leadWords.length + index, 'text-muted-foreground'),
      )}
    </Tag>
  );
}

interface HeadingProps {
  /** Carries the claim. Rendered in full-strength foreground. */
  lead: ReactNode;
  /** Continues the same sentence at the same size, in muted. */
  rest?: ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
  /** Drives the reveal from a parent instead of the viewport. */
  active?: boolean;
  delay?: number;
  /**
   * Fills the heading in word by word against scroll position rather than
   * lifting the whole block once. Needs plain strings, since the text has to
   * be split into words.
   */
  scrub?: boolean;
}

/**
 * The page's one headline treatment: a statement in full strength followed by
 * its explanation in muted, at the *same* size and weight, wrapping as one
 * paragraph.
 *
 * Splitting a heading from its subcopy by shrinking the subcopy is the default
 * everywhere; keeping one optical size and dropping only the contrast is what
 * makes the block read as a single sentence you can take in at a glance. It
 * also means the muted half can be long without turning into a wall of small
 * grey text.
 */
export function Heading({
  lead,
  rest,
  className,
  as: Tag = 'h2',
  active,
  delay = 0,
  scrub = false,
}: HeadingProps) {
  const reduced = useReducedMotion();

  // Under reduced motion the scrubbed variant is skipped entirely: tying
  // legibility to scroll position is exactly what that setting asks us not to
  // do, and the plain heading below already renders fully lit.
  const scrubbable =
    scrub &&
    !reduced &&
    active === undefined &&
    typeof lead === 'string' &&
    (rest === undefined || typeof rest === 'string');
  const ref = useRef<HTMLHeadingElement>(null);
  const shown = useRevealed(ref, active, { threshold: 0.2 });

  if (scrubbable) {
    return (
      <ScrubbedHeading
        lead={lead as string}
        rest={rest as string | undefined}
        className={className}
        as={Tag}
      />
    );
  }

  const body = (
    <>
      <span className="text-foreground">{lead}</span>
      {rest ? <span className="text-muted-foreground"> {rest}</span> : null}
    </>
  );

  if (reduced) {
    return (
      <Tag ref={ref} className={cn('text-balance', className)}>
        {body}
      </Tag>
    );
  }

  return (
    <Tag ref={ref} className={cn('text-balance', className)}>
      <m.span
        className="block"
        initial={{ opacity: 0, y: 14 }}
        animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
        transition={{ duration: DUR.base, ease: EASE, delay }}
      >
        {body}
      </m.span>
    </Tag>
  );
}
