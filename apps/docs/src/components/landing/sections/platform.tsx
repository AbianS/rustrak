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
 * The recreated screens, split out of the initial bundle.
 *
 * Between them they are the single largest thing the landing ships. Every one
 * is a few hundred nodes of real product UI, and they were all being
 * downloaded, parsed, hydrated *and* serialised into the exported HTML on first
 * paint, for dashboards that live three, four and five scrolls below the fold.
 *
 * `ssr: false` is what removes them from the HTML as well as the bundle, and it
 * is safe here for a specific reason rather than as a general habit: these are
 * `aria-hidden` decorations. They carry no copy a reader needs, nothing a
 * search engine should index, and nothing a visitor without JavaScript loses by
 * their absence. The claim each chapter makes is in its heading, which is
 * server-rendered as it always was.
 *
 * The hero's own screen is deliberately *not* in this list. It is the first
 * impression and it is above the fold, so deferring it would be trading the
 * metric for the thing the metric exists to protect.
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

/**
 * How a chapter is laid out.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * Every chapter used to be the same three modules in the same order: statement,
 * showcase, two-up. Individually each one was fine and together they were a
 * list. By the third the reader has learned the shape and stops looking, which
 * is the worst thing a section full of product screens can do to itself. The
 * screens were being skipped not because they were weak but because the reader
 * already knew where each one would be.
 *
 * So the modules stay and their arrangement changes. The variants are not
 * decoration; each is chosen for what its chapter has to say:
 *
 * `stacked`  Statement, screen, two-up. The plain form.
 *
 * `wide`     Screen, then a strip of four short facts and no two-up. The
 *            quietest chapter, for the ones whose argument is a list of
 *            properties rather than a mechanism.
 *
 * `inverted` Two-up first, screen last. The detail earns the context, instead
 *            of the context introducing the detail, and the chapter ends on its
 *            largest image rather than on small print.
 *
 * There used to be a fourth, `aside`, which put the statement in a 20rem column
 * beside the screen. It is gone, and the reason is worth keeping: a surface
 * drawn at 1:1 needs every pixel of the cell. In that layout the window was
 * 734px onto a 1240px screen, so almost half the product was outside the page
 * before the fade even started, and the chapter read as a fragment of something
 * rather than a view of it. Vertical arrangement varies the rhythm just as
 * well and costs the screens nothing.
 */
type Variant = 'stacked' | 'wide' | 'inverted';

/**
 * The size every screen is authored against, and the reason `width` and
 * `height` are not per-chapter knobs.
 *
 * These mocks are laid out as pages: a column with `flex-1` and `min-h-0` in
 * the middle, sized to fill an application viewport. Hand one of them a
 * different height and nothing crops, everything *stretches*: the table grows
 * padding it does not have in the product, or the toolbar and the pagination
 * row drift apart until the screen is a recreation of nothing. An earlier pass
 * gave each chapter its own 640 or 780 and every one of them was subtly wrong
 * in a way that was hard to name and easy to feel.
 *
 * So the surface is always drawn at the app's own viewport, and the framing is
 * done entirely by the window in front of it: `offsetY` picks where the window
 * starts and `view` how tall it is. Crop, never resize.
 */
const DESIGN_WIDTH = 1240;
const DESIGN_HEIGHT = 840;

/**
 * How far the two open edges dissolve. One constant rather than four literals,
 * because the whole point of the effect is that the chapters agree: four
 * near-identical numbers is four places to edit and four chances to drift, and
 * a page where one surface fades over a third of its width and the next over a
 * tenth does not read as a treatment, it reads as a bug.
 *
 * These are deliberately deep. The first pass ran at 0.12 to 0.16 and was
 * technically present and visually absent: at that depth the gradient is over
 * before the eye registers it started, so the surface still terminated in what
 * looked like a straight cut and the whole device was doing nothing. A third of
 * the width is enough that the UI visibly *thins* into the band rather than
 * stopping in it.
 *
 * `right` is capped short of where it would eat the data. Both waterfalls put
 * their duration column at the far right of the design, so a deeper fade takes
 * the numbers before it takes anything expendable.
 */
const DISSOLVE: Fade = { right: 0.34, bottom: 0.26 };

/**
 * How a chapter's screen is drawn. There is one answer, and there used to be
 * two.
 *
 * Every chapter is now a surface: one part of the product at 1:1, cropped by
 * the band and dissolved into it at the open edges (see
 * `primitives/bleed.tsx`).
 *
 * The first chapter was the exception for a while. It showed the whole
 * application inside `AppFrame`, authored at 1240x840 and scaled to fit an
 * 800px cell, on the argument that the reader should meet the shape of the
 * product before meeting parts of it. Two things were wrong with it. The scale
 * put the app's 14px label on screen at 9px, so the screen that was supposed to
 * establish the product was the least legible one on the page. And it sat in
 * the middle of its band with air on both sides while every chapter below it
 * was a window cut into the page, so it matched none of the things it was
 * introducing.
 *
 * Nothing was lost by dropping it. The rail and the header still appear in the
 * first chapter, which sets `chrome`; they are part of what that surface
 * contains rather than a separate presentation mode with its own geometry.
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
   * True for exactly one chapter, the first, and false for the rest. The claim
   * "this is a real application and not four screenshots" has to be made once,
   * while the reader still has reason to doubt it, and the rail is what makes
   * it. After that the chrome is 256px of navigation the reader has already
   * understood, and every chapter that keeps it pays for it out of the surface
   * it is actually there to show.
   *
   * The difference is now only what the surface contains. It used to also be a
   * different geometry, and that was the mistake: see the note above.
   */
  chrome?: boolean;
  /** Overrides `DISSOLVE` for a chapter that needs its own edges. */
  fade?: Fade;
}

interface Chapter {
  /** The label in the rail. Short enough to scan as a list. */
  label: string;
  lead: string;
  rest: string;
  variant: Variant;
  /** The surface this chapter shows, at 1:1, cropped by the band. */
  screen: Screen;
  /** Absent on `wide`, which closes with `facts` instead. */
  split?: [Half, Half];
  /** Only on `wide`. Four properties, stated and not argued. */
  facts?: { label: string; value: string }[];
}

const CHAPTERS: Chapter[] = [
  {
    label: 'Issues',
    variant: 'stacked',
    lead: 'Ten thousand crashes, one line to read.',
    rest: 'Deterministic fingerprinting folds every event with the same cause into a single issue, so triage starts with a list you can finish rather than a stream you can only sample.',
    screen: {
      node: <MockIssues />,
      chrome: true,
      /*
        Opens at the top, like the performance and agent trace chapters: the
        screen's own page header is the margin and nothing is sliced.

        This chapter used to be the exception. It showed the whole application
        inside `AppFrame`, scaled to 0.65 to fit an 800px cell and floating in
        the middle of the band with air on both sides, on the theory that the
        reader should be shown the shape of the product once before being shown
        parts of it. The theory was fine and the result was not: it read as a
        panel sitting on the page while every chapter under it read as a window
        cut into it, so the one screen meant to establish the others was the one
        that matched none of them.
      */
      view: 660,
    },
    split: [
      {
        lead: 'One cause, one row.',
        rest: 'The same exception from a thousand sessions is a single issue with a count, not a thousand lines to scroll past.',
        visual: <GroupingMini />,
      },
      {
        lead: 'Told once, where you already are.',
        rest: 'Rules fire on first seen, on regression or on a spike, and reach Slack, Discord, PagerDuty, email or a webhook.',
        visual: <AlertRoutesMini />,
      },
    ],
  },
  {
    label: 'Stack traces',
    variant: 'stacked',
    lead: 'Land on the line you wrote.',
    rest: 'Source maps are applied server side against the release that produced them, so the frame you open is the one in your editor and not the one your bundler emitted.',
    screen: {
      node: <MockIssueDetail />,
      /*
        The page, not the panel.

        A tighter window sat at 478 and framed the Stack Trace card on its own,
        which is a defensible reading of a chapter called "stack traces" and was
        the wrong call: cropped that hard it stops being a screen and becomes a
        diagram of one. What sells this chapter is recognising the *page* the
        trace lives on, with the tabs above it and the panels around it, and
        then finding the resolved frame inside all of that.

        It opens at the top, and that is the conclusion of three attempts that
        each cut something. This screen has no clear horizontal gap to open on.
        Measured, the title runs 34 to 74, the action buttons 138 to 187, and
        the "Events in this issue" card starts at 188 with no space between it
        and the buttons at all. So every offset picked to sit "just above" one
        element lands inside the one before it: 180 left an 8px sliver that read
        as a misalignment against the framed hairline, and 164, chosen as 24px
        above the card, went straight through the middle of the buttons.

        There is nowhere in the upper half of this page to make a clean cut, so
        the answer is not to cut there. Opening at 0 means the screen's own top
        padding is the margin, exactly as in the performance and agent trace
        chapters, and nothing anywhere in frame is sliced.

        It also happens to be the better composition. This chapter is the one
        that has to be recognisable as a *page* rather than a panel, so having
        the title, the actions, the event chart and the tab strip all present,
        with the stack trace opening underneath them and running out of the
        bottom of the band, is the argument. The trade is that the trace itself
        gets the lower third rather than the whole frame.
      */
      view: 700,
    },
    split: [
      {
        lead: 'Uploaded once, applied always.',
        rest: 'Artifacts are resolved against the release that produced them, so an event from six months ago still symbolicates correctly.',
        visual: <StackFrameMini />,
      },
      {
        lead: 'The seconds before the throw.',
        rest: 'Breadcrumbs arrive with the event: the route, the request and the click that led into the frame that failed.',
        visual: <BreadcrumbsMini />,
      },
    ],
  },
  {
    label: 'Performance',
    variant: 'wide',
    lead: 'Where the request actually went.',
    rest: 'Every span the SDK emits lands on one timeline, so a slow endpoint stops being a number and becomes a picture: the queries, the third-party call that costs more than all of them, and the gaps in between.',
    screen: {
      node: <MockPerformance />,
      view: 560,
      /*
        Left, not centred, and that is a judgement about what may be lost.

        A centred surface crops evenly, which sounds fair and is not: it takes
        the first characters of every label at the same time as the last. The
        transaction name lost its verb and the section header read "WATERFALL"
        with the word "SPAN" outside the page. Pinned left, everything that
        starts a line is safe and the crop falls entirely on the duration
        column, which is the right thing to spend: the *shape* of this picture
        is its argument, and `903ms` only confirms what the long green bar has
        already said.
      */
    },
    facts: [
      { label: 'Spans', value: 'the full tree' },
      { label: 'Timing', value: 'self and total' },
      { label: 'Ops', value: 'db, http, cache' },
      { label: 'Source', value: 'the same DSN' },
    ],
  },
  {
    label: 'Logs',
    variant: 'inverted',
    lead: 'The five minutes before the crash.',
    rest: 'Structured logs come through the same DSN and sit on the same timeline as the errors they precede, with every attribute the SDK attached still keyed and still typed.',
    screen: {
      node: <MockLogs />,
      // Opens on the level filter at 115, so the seven levels are the first
      // thing in frame and the page title above them is left to the heading.
      offsetY: 96,
      view: 600,
    },
    split: [
      {
        lead: 'Every level, one stream.',
        rest: 'Trace through fatal arrive on the same endpoint and filter in the same list, so a debug line and the error it explains are one scroll apart.',
        visual: <LogLevelsMini />,
      },
      {
        lead: 'Attributes stay attributes.',
        rest: 'What the SDK attached is stored keyed and typed rather than flattened into the message, so it is still something you can filter on.',
        visual: <AttributesMini />,
      },
    ],
  },
  {
    label: 'Agent traces',
    variant: 'wide',
    lead: 'See what the model actually cost you.',
    rest: 'Model calls and tool calls arrive as spans, with the tokens and the latency sitting next to the call that spent them.',
    screen: {
      node: <MockAgents />,
      /*
        No offset at all, and this one is worth stating because it changed for
        a reason rather than by taste. The window used to open at 36, which
        clipped the "← Agents" back link the real page carries above the title.
        Removing the link (see mock-agents.tsx) moved everything under it up by
        that same amount, so the offset that had been hiding a stray row was
        suddenly eating the title instead.
        At 0 the screen's own 24px of top padding does the work, and the run's
        header (name, duration, token count) sits complete in frame, which for
        this chapter is half the claim.
      */
      view: 620,
    },
    facts: [
      { label: 'Cost', value: 'tokens per span' },
      { label: 'Tools', value: 'on the timeline' },
      { label: 'Handoffs', value: 'agent to agent' },
      { label: 'Failures', value: 'the span that threw' },
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
        Pinned left, always, and that is a judgement about what may be lost.

        A centred surface crops evenly, which sounds fair and is not: it takes
        the first characters of every label at the same time as the last. The
        transaction name lost its verb and a section header read "WATERFALL"
        with the word "SPAN" outside the page. Pinned left, everything that
        starts a line is safe and the crop falls entirely on the right-hand
        columns, which is the right thing to spend. Those columns are durations
        and timestamps: worth having, never the argument.
      */}
      {/*
        No `Lift` here, and its absence is the entire reason these chapters
        assemble instead of appearing.

        `Lift` fades a surface in as one block over the first 42% of its
        approach. That is right for the issues chapter, where the panel is a
        discrete object that should arrive whole. It is actively wrong here,
        because the pieces inside are already animating against the *same*
        scroll window: the toolbar settling, the rows cascading, the bars
        sweeping out from their own start times. All of that was happening
        underneath a container that was itself still fading up, so the most
        interesting half of the build played out at partial opacity and what
        reached the reader was a smudge resolving into a screen.

        Removed, the container is simply there from the first frame and every
        piece is visible for the whole of its own move. Nothing was added to
        make this spectacular; something was taken away that was hiding it.
      */}
      <div className="lg:pl-8">
        <Bleed
          width={DESIGN_WIDTH}
          height={DESIGN_HEIGHT}
          view={screen.view}
          offsetY={screen.offsetY}
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
function Facts({ facts }: { facts: { label: string; value: string }[] }) {
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
 * ── Why these are links ─────────────────────────────────────────────────────
 *
 * They used to be `<span>`s. The rail named the chapter you were in and could
 * do nothing else, which is a table of contents that has been drawn but not
 * wired: it looks exactly like something you can click, so a reader tries, and
 * nothing happens. A list of chapter titles beside a long section is the one
 * element on a page a visitor is most likely to use for getting around.
 *
 * As anchors they also cost nothing to make accessible — the list is a real
 * `<ol>` of real hrefs, so it works from the keyboard, it survives JavaScript
 * failing, and `aria-current` says which one you are on without a second
 * mechanism.
 *
 * ── Lenis has to be asked ───────────────────────────────────────────────────
 *
 * The landing runs Lenis at the root, which drives the real scroll position
 * from a frame loop. A native anchor jump fights that: the browser sets
 * `scrollTop` in one frame and Lenis writes over it in the next, so the page
 * either snaps and springs back or lands somewhere near the target. So when
 * Lenis is mounted the default is prevented and `scrollTo` is asked instead.
 *
 * `useLenis` returns `undefined` when it is not mounted — on a phone, and
 * under reduced motion — and in that case the click is left alone entirely and
 * the browser does its own instant jump, honouring `scroll-mt` as it should.
 *
 * ── Why the column is full height ───────────────────────────────────────────
 *
 * It reads as a column rather than as a floating list. Sticky at the top of
 * the viewport and as tall as the viewport, the rule down its right edge runs
 * the whole screen and the index sits at the top of it with its own header and
 * footer. Before, the list was five short labels vertically centred in a very
 * tall cell, with the result that most of the column was empty and the labels
 * had nothing to belong to.
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
    /*
      The widest and quietest chapter. No two-up and no gutter: the surface is
      given the whole width and then four short properties close it off. Used by
      the two chapters whose argument is a list of facts rather than a
      mechanism, and whose screens are pictures of time rather than lists, so
      the extra width buys something specific.
    */
    case 'wide':
      return (
        <>
          <Statement chapter={chapter} />
          <Surface
            screen={chapter.screen}
            surface="var(--surface-soft)"
            className="border-t border-rule"
          />
          {chapter.facts ? <Facts facts={chapter.facts} /> : null}
        </>
      );

    /*
      Detail first, then the screen it came out of. Closing the section on its
      largest image rather than on two columns of small print is also what
      hands the reader off to the next band with some momentum.
    */
    case 'inverted':
      return (
        <>
          <Statement chapter={chapter} />
          {chapter.split ? <Split split={chapter.split} /> : null}
          <Surface screen={chapter.screen} className="border-t border-rule" />
        </>
      );

    default:
      return (
        <>
          <Statement chapter={chapter} />
          <Surface screen={chapter.screen} className="border-t border-rule" />
          {chapter.split ? <Split split={chapter.split} /> : null}
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
          lead="Everything the SDK already sends."
          rest="Errors, logs, traces, releases and sessions land in one place, from the DSN you are pointing at Sentry today."
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
