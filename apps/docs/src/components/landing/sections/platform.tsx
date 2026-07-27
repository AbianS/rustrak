'use client';

import { useLenis } from 'lenis/react';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../app-mock/design';
import {
  AlertRoutesMini,
  AttributesMini,
  BreadcrumbsMini,
  GroupingMini,
  LogLevelsMini,
  StackFrameMini,
} from '../app-mock/minis';
import { Bare } from '../app-mock/mock-shell';
import { EASE } from '../motion';
import { Bleed, type Fade } from '../primitives/bleed';
import { Deferred } from '../primitives/deferred';
import { Band, Cell } from '../primitives/grid';
import { Heading, Pill } from '../primitives/heading';

/**
 * The recreated screens, split out of the initial bundle — between them the
 * single largest thing the landing ships, for dashboards three, four and five
 * scrolls below the fold.
 *
 * `ssr: false` removes them from the HTML as well as the bundle, and is safe
 * here for a specific reason rather than as a general habit: these are
 * `aria-hidden` decorations carrying no copy a reader needs and nothing a
 * search engine should index. The claim each chapter makes is in its heading,
 * which is server-rendered as it always was.
 *
 * The hero's own screen is deliberately not in this list. It is above the fold,
 * so deferring it would trade the metric for the thing the metric protects.
 */
const MockIssues = dynamic(
  () => import('../app-mock/mock-issues').then((mod) => mod.MockIssues),
  { ssr: false },
);
const MockIssueDetail = dynamic(
  () =>
    import('../app-mock/mock-issue-detail').then((mod) => mod.MockIssueDetail),
  { ssr: false },
);
const MockPerformance = dynamic(
  () =>
    import('../app-mock/mock-performance').then((mod) => mod.MockPerformance),
  { ssr: false },
);
const MockLogs = dynamic(
  () => import('../app-mock/mock-logs').then((mod) => mod.MockLogs),
  { ssr: false },
);
const MockAgents = dynamic(
  () => import('../app-mock/mock-agents').then((mod) => mod.MockAgents),
  { ssr: false },
);

interface Half {
  lead: string;
  rest: string;
  visual: ReactNode;
}

interface Fact {
  label: string;
  value: string;
}

/**
 * How far the two open edges dissolve. One constant rather than four literals,
 * because the whole point is that the chapters agree — one surface fading over
 * a third of its width next to one fading over a tenth reads as a bug.
 *
 * Deliberately deep. At the 0.12 to 0.16 of the first pass the gradient is over
 * before the eye registers it started, so the surface still terminates in what
 * looks like a straight cut. A third of the width is enough that the UI visibly
 * *thins* into the band rather than stopping in it. `right` is capped short of
 * the duration column, which both waterfalls put at the far right.
 */
const DISSOLVE: Fade = { right: 0.34, bottom: 0.26 };

/**
 * How a chapter's screen is drawn: one part of the product at 1:1, cropped by
 * the band and dissolved into it at the open edges (see `primitives/bleed.tsx`).
 *
 * Every screen is authored at the app's own viewport (`DESIGN_WIDTH` by
 * `DESIGN_HEIGHT`) and never resized, because these mocks are laid out as pages
 * — a column with `flex-1` and `min-h-0` sized to fill an application viewport.
 * Hand one a different height and nothing crops, everything *stretches*: the
 * table grows padding it does not have in the product, or the toolbar and the
 * pagination row drift apart. So framing is done entirely by the window in
 * front: `offsetY` picks where it starts and `view` how tall it is.
 */
interface Screen {
  node: ReactNode;
  /**
   * Pixels of the screen hidden above the window. This is the framing decision:
   * it is what lets a chapter open on the stack trace rather than on the page
   * header that happens to sit above it.
   */
  offsetY?: number;
  /** Height of the window. Everything below it runs out of the band. */
  view: number;
  /**
   * Keeps the application chrome: the global header and the project rail.
   *
   * True for exactly one chapter, the first. "This is a real application and
   * not four screenshots" has to be made once, while the reader still has
   * reason to doubt it, and the rail is what makes it; after that the chrome is
   * 256px of navigation paid for out of the surface it is there to show.
   */
  chrome?: boolean;
  /** Overrides `DISSOLVE` for a chapter that needs its own edges. */
  fade?: Fade;
}

interface ChapterBase {
  /** The label in the rail. Short enough to scan as a list. */
  label: string;
  lead: string;
  rest: string;
  /** The surface this chapter shows, at 1:1, cropped by the band. */
  screen: Screen;
}

/**
 * How a chapter is laid out.
 *
 * Every chapter used to be the same three modules in the same order: statement,
 * showcase, two-up. Individually each was fine and together they were a list —
 * by the third the reader has learned the shape and stops looking, which is the
 * worst thing a section full of product screens can do to itself. So the
 * modules stay and their arrangement changes, and each variant carries exactly
 * the pieces it uses rather than a bag of optional ones.
 *
 * There used to be a fourth, `aside`, which put the statement in a 20rem column
 * beside the screen. A surface drawn at 1:1 needs every pixel of the cell, and
 * in that layout the window was 734px onto a 1240px screen — almost half the
 * product outside the page before the fade even started.
 */

/** Statement, screen, two-up. The plain form. */
interface StackedChapter extends ChapterBase {
  variant: 'stacked';
  split: [Half, Half];
}

/**
 * Screen, then a strip of four short facts and no two-up. The quietest form,
 * for chapters whose argument is a list of properties rather than a mechanism.
 */
interface WideChapter extends ChapterBase {
  variant: 'wide';
  facts: [Fact, Fact, Fact, Fact];
}

/**
 * Two-up first, screen last. The detail earns the context instead of the
 * context introducing the detail, and the chapter ends on its largest image
 * rather than on small print.
 */
interface InvertedChapter extends ChapterBase {
  variant: 'inverted';
  split: [Half, Half];
}

type Chapter = StackedChapter | WideChapter | InvertedChapter;

const CHAPTERS: Chapter[] = [
  {
    label: 'Issues',
    variant: 'stacked',
    // The statement describes the list, not the grouping: the two-up below
    // sits next to a diagram of events folding onto one issue, and can say
    // nothing else, so the mechanism belongs there.
    lead: 'Start with a list, not a stream.',
    rest: 'Every row carries a status, a priority and a 24-hour trend, so new issues, regressions and escalations are visible before you open anything.',
    screen: {
      node: <MockIssues />,
      chrome: true,
      // Opens at the top, like the performance and agent trace chapters: the
      // screen's own page header is the margin and nothing is sliced.
      view: 660,
    },
    split: [
      {
        lead: 'Automatic grouping.',
        rest: 'Every event with the same fingerprint lands on the same issue, with a counter instead of a thousand duplicates.',
        visual: <GroupingMini />,
      },
      {
        // Deliberately short of everything it could say: the `Alerts` band is
        // a full-width diagram of the same routing, and explaining it here
        // leaves that band with nothing left to announce.
        lead: 'Alerts where you already work.',
        rest: 'A rule decides which issues are worth an interruption and which channel they arrive on.',
        visual: <AlertRoutesMini />,
      },
    ],
  },
  {
    label: 'Stack traces',
    variant: 'stacked',
    // Same division as `Issues`: the statement describes the page, the two-up
    // below keeps the mechanism. Both used to explain source maps, in nearly
    // the same words.
    lead: 'Open an event and land on your own source.',
    rest: 'The failing frame, the breadcrumbs before it, the tags and the context are on one page, with the next event one click away.',
    screen: {
      node: <MockIssueDetail />,
      /*
        The page, not the panel. Cropped tight onto the Stack Trace card it
        stops being a screen and becomes a diagram of one; what sells this
        chapter is recognising the *page* the trace lives on and then finding
        the resolved frame inside all of it.

        Opens at 0 because this screen has no clear horizontal gap to cut on:
        the title runs 34 to 74, the action buttons 138 to 187, and the "Events
        in this issue" card starts at 188 with no space between it and the
        buttons at all, so every offset picked to sit just above one element
        lands inside the one before it. The screen's own top padding is the
        margin instead, and nothing in frame is sliced.
      */
      view: 700,
    },
    split: [
      {
        lead: 'Source maps applied server side.',
        rest: 'Maps are resolved against the release that produced the event, so a crash from six months ago still lands on the right line.',
        visual: <StackFrameMini />,
      },
      {
        // Headings here name the feature rather than narrating it: "The
        // seconds before the throw" was also the `Logs` chapter's heading, and
        // neither told a reader scanning the page what sat under it.
        lead: 'Breadcrumbs with every event.',
        rest: 'The route, the request and the click that led into the frame that failed.',
        visual: <BreadcrumbsMini />,
      },
    ],
  },
  {
    label: 'Performance',
    variant: 'wide',
    lead: 'See where every request spends its time.',
    rest: 'Every span the SDK sends lands on one waterfall: queries, outbound calls and cache lookups, with total and self time on each row.',
    screen: {
      node: <MockPerformance />,
      view: 560,
    },
    facts: [
      { label: 'Spans', value: 'the full tree' },
      { label: 'Timing', value: 'self and total' },
      { label: 'Ops', value: 'db, http, cache' },
      { label: 'Ingest', value: 'the same DSN' },
    ],
  },
  {
    label: 'Logs',
    variant: 'inverted',
    lead: 'Logs and errors in the same system.',
    rest: 'Structured logs arrive through the same DSN and carry the trace ID, so the lines that ran before a crash are one click from the crash itself.',
    screen: {
      node: <MockLogs />,
      // Opens on the level filter at 115, so the seven levels are the first
      // thing in frame and the page title above them is left to the heading.
      offsetY: 96,
      view: 600,
    },
    split: [
      {
        lead: 'Six levels, one view.',
        rest: 'Trace, debug, info, warn, error and fatal all arrive on the same endpoint and filter in the same list.',
        visual: <LogLevelsMini />,
      },
      {
        lead: 'Attributes stay typed.',
        rest: 'What the SDK attached is stored keyed and typed instead of flattened into the message, so you can still filter on it.',
        visual: <AttributesMini />,
      },
    ],
  },
  {
    label: 'Agent traces',
    variant: 'wide',
    lead: 'Debug agents like any other request.',
    rest: 'Model calls, tool calls and handoffs between agents arrive as spans, on the same waterfall as your HTTP and database work.',
    screen: {
      node: <MockAgents />,
      // No offset: the screen's own 24px of top padding does the work, and the
      // run's header (name, duration, token count) sits complete in frame,
      // which for this chapter is half the claim.
      view: 620,
    },
    facts: [
      { label: 'Tokens', value: 'input and output' },
      { label: 'Latency', value: 'per span' },
      { label: 'Handoffs', value: 'agent to agent' },
      { label: 'Status', value: 'on every span' },
    ],
  },
];

/**
 * Tracks which chapter is under the middle of the viewport.
 *
 * The margins collapse the observer's root to a band across the centre of the
 * screen, so exactly one chapter is ever intersecting and the rail never has
 * to arbitrate between two. Steadier than deriving an index from scroll
 * position, which jitters at the boundaries.
 */
function useActiveChapter(count: number) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = refs.current.indexOf(entry.target as HTMLElement);
          if (index >= 0) setActive(index);
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );

    for (const element of refs.current) {
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [count]);

  return { refs, active };
}

/**
 * One surface at 1:1, cropped by the band.
 *
 * `Bare` is what drops the header and the rail. `Deferred` sits inside the
 * `Bleed` rather than around it, so the window holds its height while the chunk
 * is still in flight and the page never jumps: the visitor sees an empty band
 * fill in, which is what the scrubbed entrance was going to show them anyway.
 */
function Surface({
  screen,
  className,
  surface = 'var(--surface)',
}: {
  screen: Screen;
  className?: string;
  surface?: string;
}) {
  return (
    <div
      /*
        Padded at the top and open at the bottom, which is the asymmetry the
        whole device depends on. Space above lets the surface arrive rather than
        start abruptly at the band's rule; no space below is what makes it run
        out of the band instead of ending inside it. A symmetric cell would put
        the surface back in a box, and the box is what we just removed.

        `overflow-x-clip` rather than `hidden`, so a surface wider than the cell
        is trimmed at the frame without the cell becoming a scroll container.
        The `Bleed` clips its own contents too, but the left-aligned case is
        deliberately pushed past the right edge of its column and this is what
        catches it.
      */
      className={cn('overflow-x-clip pt-9 sm:pt-14', className)}
      style={{ background: surface }}
    >
      {/*
        Nothing fades the surface in as a block. The pieces inside are already
        animating against the same scroll window — the toolbar settling, rows
        cascading, bars sweeping out from their start times — and a container
        fading up underneath all of that turned the most interesting half of the
        build into a smudge resolving into a screen.
      */}
      <div className="lg:pl-8">
        <Bleed
          width={DESIGN_WIDTH}
          height={DESIGN_HEIGHT}
          view={screen.view}
          offsetY={screen.offsetY}
          /* Left, not centred, which is a judgement about what may be lost. A
             centred surface crops evenly, which takes the first characters of
             every label at the same time as the last — a transaction name loses
             its verb and a header reads "WATERFALL" with "SPAN" off the page.
             Pinned left, everything that starts a line is safe and the crop
             falls entirely on the duration and timestamp columns: worth having,
             never the argument. */
          align="left"
          fade={screen.fade ?? DISSOLVE}
          framed
        >
          <Deferred className="h-full w-full">
            {screen.chrome ? screen.node : <Bare>{screen.node}</Bare>}
          </Deferred>
        </Bleed>
      </div>
    </div>
  );
}

/** The pair of smaller claims that closes most chapters. */
function Split({ split }: { split: [Half, Half] }) {
  return (
    <div className="grid grid-cols-1 border-t border-rule bg-[var(--surface-soft)] md:grid-cols-2">
      {split.map((half, index) => (
        <div
          key={half.lead}
          className={`min-w-0 border-rule px-4 py-9 sm:px-10 sm:py-12 ${
            index === 0 ? 'border-b md:border-b-0 md:border-r' : ''
          }`}
        >
          <Heading
            className="text-[17.5px] leading-snug tracking-[-0.015em] sm:text-[19px]"
            as="h3"
            lead={half.lead}
            rest={half.rest}
          />
          <div className="mt-6 sm:mt-8">{half.visual}</div>
        </div>
      ))}
    </div>
  );
}

/** The chapter's opening claim. */
function Statement({
  chapter,
  className,
}: {
  chapter: Chapter;
  className?: string;
}) {
  return (
    <Cell className={className}>
      {/* The rail is gone below `lg`, and with it the only thing naming the
          chapter you are in. It comes back as an eyebrow over each heading
          rather than as a floating index: there is no room for a persistent
          one, and five labels stacked at the top would be a table of contents
          nobody asked for. */}
      <p className="eyebrow mb-4 lg:hidden">{chapter.label}</p>
      <Heading
        className="display-md max-w-[46ch]"
        lead={chapter.lead}
        rest={chapter.rest}
      />
    </Cell>
  );
}

/** The strip of short properties that closes a `wide` chapter. */
function Facts({ facts }: { facts: readonly Fact[] }) {
  return (
    <ul className="grid grid-cols-2 border-t border-rule lg:grid-cols-4">
      {facts.map((fact, index) => (
        <li
          key={fact.label}
          className={[
            'border-rule px-4 py-7 sm:px-10 sm:py-9',
            index === 1 ? 'lg:border-r' : index === 3 ? '' : 'border-r',
            index < 2 ? 'border-b lg:border-b-0' : '',
          ].join(' ')}
        >
          <p className="eyebrow">{fact.label}</p>
          <p className="mt-2 font-mono text-[14px] text-foreground sm:text-[15px]">
            {fact.value}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** `Stack traces` → `stack-traces`. The chapter's anchor, and the rail's target. */
function slug(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '-');
}

/**
 * How far above a chapter the scroll lands when the rail is used.
 *
 * The fixed nav is 4rem; the rest is breathing room so the chapter's opening
 * line does not arrive flush against the bar. Applied twice on purpose — as
 * `scroll-mt` for the browser's own anchor jump, and as Lenis' offset when
 * Lenis is the one moving the page. They have to agree or the same link lands
 * in two different places depending on the input device.
 */
const JUMP_OFFSET = 96;

/**
 * The chapter index, as navigation rather than as a caption.
 *
 * Real anchors rather than `<span>`s: a list of chapter titles beside a long
 * section is the element a visitor is most likely to use for getting around, so
 * one that looks clickable and is not is a table of contents drawn but not
 * wired. As a real `<ol>` of hrefs it also works from the keyboard, survives
 * JavaScript failing, and gets `aria-current` for free.
 *
 * Lenis has to be asked, though. It drives the real scroll position from a
 * frame loop, so a native anchor jump fights it — the browser sets `scrollTop`
 * in one frame and Lenis writes over it in the next. When it is mounted the
 * default is prevented and `scrollTo` used instead; `useLenis` returns
 * `undefined` when it is not (on a phone, under reduced motion) and the click
 * is left alone to honour `scroll-mt`.
 *
 * The column is full height so it reads as a column rather than a floating
 * list: the rule down its right edge runs the whole screen, with the index at
 * the top of it.
 */
function ChapterRail({ active }: { active: number }) {
  const lenis = useLenis();
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const [marker, setMarker] = useState({ y: 0, height: 0 });

  /*
    The lit segment is measured rather than computed. Deriving it from an index
    and a row height means every change to the type scale silently moves the
    marker off its label, and the labels are not all one line at every width.
  */
  useEffect(() => {
    const element = items.current[active];
    if (!element) return;

    const measure = () =>
      setMarker({ y: element.offsetTop, height: element.offsetHeight });
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [active]);

  const jump = (event: MouseEvent<HTMLAnchorElement>, label: string) => {
    // No Lenis, no interference: let the browser jump and honour `scroll-mt`.
    if (!lenis) return;
    const id = slug(label);
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    lenis.scrollTo(target, { offset: -JUMP_OFFSET });
    /*
      Preventing the default also prevents the hash being written, and the hash
      is half of what makes these links worth having: a reader who wants to send
      somebody the logs chapter needs the address bar to say so. `replaceState`
      rather than `pushState` — the browser's back button should leave the page,
      not walk back up five chapters one at a time.
    */
    history.replaceState(null, '', `#${id}`);
  };

  return (
    <nav
      aria-label="Platform chapters"
      className="sticky top-16 flex h-[calc(100svh-4rem)] flex-col px-10 pt-20 pb-12"
    >
      <p className="eyebrow">Chapters</p>

      <ol className="relative mt-8">
        {/* The rule the marker rides. Continuous behind the whole list, so the
            lit segment reads as part of it lighting up rather than as a tick
            that appears next to a word. */}
        <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-rule" />
        <motion.span
          aria-hidden
          className="absolute left-0 w-px bg-primary"
          initial={false}
          animate={{ y: marker.y, height: marker.height }}
          transition={{ duration: 0.5, ease: EASE }}
        />

        {CHAPTERS.map((chapter, index) => (
          <li
            key={chapter.label}
            ref={(element) => {
              items.current[index] = element;
            }}
          >
            <a
              href={`#${slug(chapter.label)}`}
              onClick={(event) => jump(event, chapter.label)}
              aria-current={index === active ? 'true' : undefined}
              className="group flex items-baseline gap-3 py-2.5 pl-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {/* Numbered, like every other section on the page. The index is
                  what turns five labels into a sequence with a length, which
                  is most of what a reader wants from a rail: not only where
                  they are but how much is left. */}
              <span
                className={cn(
                  'font-mono text-[11px] tabular-nums transition-colors duration-300',
                  index === active
                    ? 'text-primary'
                    : 'text-muted-foreground/45 group-hover:text-muted-foreground',
                )}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              {/*
                A colour transition, not an opacity one. At `opacity: 0.32` the
                label was being faded towards the band behind it, which on this
                surface turns white type muddy grey-green rather than quiet.
                Interpolating between two real colours keeps the idle state a
                deliberate tone, and it is what leaves room for a hover state
                in between — an item you can click has to answer the pointer.
              */}
              <span
                className={cn(
                  'text-[17px] leading-tight transition-colors duration-300',
                  index === active
                    ? 'text-foreground'
                    : 'text-muted-foreground/60 group-hover:text-foreground/85',
                )}
              >
                {chapter.label}
              </span>
            </a>
          </li>
        ))}
      </ol>

      {/* The column's floor. A reader who is scanning chapter titles beside a
          section of product screens is exactly the one who wants the reference,
          and it gives the bottom of a full-height column something to be. */}
      <Link
        href="/getting-started/overview"
        className="group mt-auto inline-flex items-center gap-2 self-start text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        Read the docs
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </nav>
  );
}

function ChapterBody({ chapter }: { chapter: Chapter }) {
  switch (chapter.variant) {
    case 'wide':
      return (
        <>
          <Statement chapter={chapter} />
          <Surface
            screen={chapter.screen}
            surface="var(--surface-soft)"
            className="border-t border-rule"
          />
          <Facts facts={chapter.facts} />
        </>
      );

    case 'inverted':
      return (
        <>
          <Statement chapter={chapter} />
          <Split split={chapter.split} />
          <Surface screen={chapter.screen} className="border-t border-rule" />
        </>
      );

    default:
      return (
        <>
          <Statement chapter={chapter} />
          <Surface screen={chapter.screen} className="border-t border-rule" />
          <Split split={chapter.split} />
        </>
      );
  }
}

export function Platform() {
  const { refs, active } = useActiveChapter(CHAPTERS.length);

  return (
    <Band>
      <Cell className="max-w-[52rem]">
        <Pill>Platform</Pill>
        <Heading
          className="display-lg mt-6"
          lead="One place for everything your SDK sends."
          rest="Errors, logs, traces, releases and sessions, all from a single DSN."
          scrub
        />
      </Cell>

      {/*
        `minmax(0, 1fr)`, not `1fr`. A `1fr` track has an automatic minimum of
        `auto`, so it grows to whatever its widest descendant demands rather
        than holding the width it was given, which is how one over-wide row
        inside a chapter ends up widening the column, then the grid, then the
        page. Flooring the minimum at 0 makes the track keep its size and hands
        the shrinking back to the content, where `truncate` and `min-w-0` can
        deal with it. It matters more now than it did: a `Bleed` is deliberately
        wider than its cell.
      */}
      <div className="grid grid-cols-1 lg:grid-cols-[19rem_minmax(0,1fr)]">
        {/* Sticky through the whole section, so the chapter you are reading is
            always named without scrolling back for it. */}
        <aside className="hidden border-rule lg:block lg:border-r">
          <ChapterRail active={active} />
        </aside>

        <div className="min-w-0">
          {CHAPTERS.map((chapter, index) => (
            <article
              key={chapter.label}
              id={slug(chapter.label)}
              ref={(element) => {
                refs.current[index] = element;
              }}
              className={`min-w-0 scroll-mt-24 ${
                index < CHAPTERS.length - 1 ? 'border-b border-rule' : ''
              }`}
            >
              <ChapterBody chapter={chapter} />
            </article>
          ))}
        </div>
      </div>
    </Band>
  );
}
