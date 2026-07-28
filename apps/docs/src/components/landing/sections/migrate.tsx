'use client';

import { useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { useRef } from 'react';
import { EASE } from '../motion';
import { Band, Cell } from '../primitives/grid';
import { Heading, Pill } from '../primitives/heading';
import { useOnScreen } from '../use-on-screen';

/**
 * The migration, as the one line it actually is.
 *
 * This is the section the page was missing, and it is missing from most
 * self-hosted alternatives' landings too: they argue that they are *as good
 * as* the incumbent and never show how much work switching is. The whole
 * proposition here is that the answer is "one line", so the line is what gets
 * shown — struck through and replaced, at the size of the claim.
 *
 * The rest of the file is the supporting fact that makes the line believable:
 * the SDK is unchanged, so everything built on it is unchanged too.
 */

/** The `Sentry.init` block, with the one line that moves marked. */
const LINES: { text: string; state: 'kept' | 'removed' | 'added' }[] = [
  { text: 'Sentry.init({', state: 'kept' },
  {
    text: '  dsn: "https://abc123@o447951.ingest.sentry.io/1234567",',
    state: 'removed',
  },
  { text: '  dsn: "https://abc123@errors.yourcompany.com/1",', state: 'added' },
  { text: '  tracesSampleRate: 1.0,', state: 'kept' },
  { text: '  environment: "production",', state: 'kept' },
  { text: '});', state: 'kept' },
];

/** What survives the change, which is the actual argument. */
const UNCHANGED = [
  { label: 'SDK', detail: 'The official package, at the version you pinned.' },
  { label: 'Instrumentation', detail: 'Every capture, span and breadcrumb.' },
  { label: 'Source maps', detail: 'The same upload step in the same CI job.' },
  { label: 'Releases', detail: 'Tagged with the release you already set.' },
];

export function Migrate() {
  const reduced = useReducedMotion();
  const block = useRef<HTMLDivElement>(null);
  /*
    Once. The strike-through and the line sliding in are a one-shot event, not
    a state to scrub. The heading does say the change is reversible, but that is
    a claim about an operator typing the old DSN back in, not about scroll
    position: a line that un-replaces itself every time the reader scrolls up
    reads as an animation that cannot make up its mind.
  */
  const shown = useOnScreen(block, { once: true, rootMargin: '-15% 0px' });

  return (
    <Band>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <Cell className="max-w-[46rem]">
            <Pill>Migration</Pill>
            <Heading
              className="display-lg mt-6"
              lead="One line of configuration."
              rest="Point the DSN at your own server and deploy. Point it back and the migration is reverted."
              scrub
            />
          </Cell>

          {/*
            The diff scrolls sideways below `sm`, and it has to.

            The line that matters is the replacement DSN, which is 56 characters
            of monospace — at 390 wide it would have to come down to about 9px
            to fit, and the whole section is an argument that this one line is
            the entire migration. A line the reader has to squint at does not
            make that argument.

            So it keeps its size and the block scrolls, with a fade at the right
            edge to say so. The fade is `sm:hidden` rather than conditional on
            measurement: above that width the snippet fits at every size this
            page runs at, so a scroll hint there would be a gradient over
            nothing.
          */}
          <div className="relative border-t border-rule bg-[var(--surface)]">
            <div
              ref={block}
              className="overflow-x-auto overscroll-x-contain px-4 py-8 sm:px-10 sm:py-12"
            >
              <pre className="min-w-max font-mono text-[12px] leading-[2] sm:text-[13.5px]">
                {LINES.map((line, index) => {
                  const removed = line.state === 'removed';
                  const added = line.state === 'added';

                  return (
                    // react-doctor-disable-next-line react-doctor/no-array-index-as-key
                    <m.div
                      // Lines are a fixed authored snippet, never reordered.
                      key={`${index}-${line.state}`}
                      className="relative flex items-center gap-3"
                      initial={
                        reduced || !added ? false : { opacity: 0, x: -12 }
                      }
                      animate={
                        reduced || !added
                          ? undefined
                          : shown
                            ? { opacity: 1, x: 0 }
                            : { opacity: 0, x: -12 }
                      }
                      transition={{ duration: 0.7, ease: EASE, delay: 0.55 }}
                    >
                      {/* The gutter mark. Kept lines get a blank of the same
                        width so nothing shifts sideways between states. */}
                      <span
                        aria-hidden
                        className={
                          removed
                            ? 'w-3 shrink-0 text-center text-destructive'
                            : added
                              ? 'w-3 shrink-0 text-center text-primary'
                              : 'w-3 shrink-0'
                        }
                      >
                        {removed ? '−' : added ? '+' : ''}
                      </span>

                      <span
                        className={
                          removed
                            ? 'relative text-white/32'
                            : added
                              ? 'text-primary'
                              : 'text-white/55'
                        }
                      >
                        {line.text}
                        {/* Drawn rather than `line-through`, so it can be timed
                          with the replacement arriving underneath it. */}
                        {removed ? (
                          <m.span
                            aria-hidden
                            className="absolute inset-y-0 left-0 my-auto block h-px bg-destructive/70"
                            initial={reduced ? { width: '100%' } : { width: 0 }}
                            animate={
                              reduced
                                ? undefined
                                : { width: shown ? '100%' : 0 }
                            }
                            transition={{
                              duration: 0.5,
                              ease: EASE,
                              delay: 0.15,
                            }}
                          />
                        ) : null}
                      </span>
                    </m.div>
                  );
                })}
              </pre>
            </div>

            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[var(--surface)] via-[var(--surface)]/70 to-transparent sm:hidden"
            />
          </div>
        </div>

        {/*
          The list of what survives, as a column beside the diff rather than a
          row under it. Side by side, the eye reads "one line changed, four
          things did not" as a single comparison; stacked, it reads as two
          unrelated blocks and the second one looks like filler.
        */}
        <ul className="border-t border-rule bg-[var(--surface-soft)] lg:border-l lg:border-t-0">
          {UNCHANGED.map((item, index) => (
            <li
              key={item.label}
              className={`px-5 py-6 sm:px-8 sm:py-7 ${
                index < UNCHANGED.length - 1 ? 'border-b border-rule' : ''
              }`}
            >
              <p className="flex items-baseline gap-2 text-[14.5px] font-medium text-foreground">
                <span className="eyebrow text-primary">Unchanged</span>
                {item.label}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {item.detail}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Band>
  );
}
