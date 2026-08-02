'use client';

import {
  type MotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import * as m from 'motion/react-m';
import { useRef } from 'react';
import { Band, Cell } from '@/components/frame/grid';
import { cn } from '@/lib/utils';
import { Heading, Pill } from '../primitives/heading';

/**
 * One alert rule, drawn as the branching thing it is.
 *
 * ── What this replaces, and why it kept being wrong ─────────────────────────
 *
 * This slot has now held four things, and the first three failed differently.
 * A row of six icons, which said every feature mattered equally. A vertical
 * timeline of the ingest pipeline, which is a changelog shape for something
 * that is not a sequence. That pipeline as a graph, which was the right shape
 * for the wrong subject — it explained how the server is built internally, and
 * a reader deciding whether to adopt an error tracker is not yet asking that.
 *
 * A rule is a better subject for the same drawing. It is something the reader
 * *writes*, it genuinely branches, and the branch is the argument: the error at
 * three in the morning pages somebody, everything quieter waits until morning.
 * Nobody adopts a tool because its ingest is asynchronous. People do adopt one
 * because it stops waking them up for warnings.
 *
 * ── No icons ────────────────────────────────────────────────────────────────
 *
 * The fourth version put a rounded-square icon chip on every node, and that
 * single habit is what made it read as generated rather than drawn. A tiny
 * pictogram beside a label is decoration that has to be decoded before the
 * label can be: it takes the eye first, says nothing the words did not, and
 * repeats identically down the graph so the nodes stop being distinguishable
 * from each other.
 *
 * What real node editors put there instead is a **port** — the dot a wire
 * physically connects to. It occupies the same few pixels, it is not
 * decoration, and it makes the wires read as attached rather than as lines that
 * happen to end nearby.
 *
 * ── And it is small ─────────────────────────────────────────────────────────
 *
 * The canvas is sized to the graph rather than to the column. A diagram
 * floating in a field of dots reads as thin however good the nodes are, because
 * empty space around a small thing is the same signal as a slide with one
 * bullet on it.
 */

const DESIGN_W = 560;
/**
 * Taller than the graph strictly needs. The gaps between nodes are the only
 * thing separating a wired diagram from a stack of cards with lines through it,
 * and they were cut too far chasing a complaint that turned out to be about the
 * column's width rather than the spacing inside it.
 */
const DESIGN_H = 470;

interface FlowNode {
  id: string;
  title: string;
  detail: string;
  /** `mono` sets the title as code: conditions are expressions, not prose. */
  mono?: boolean;
  tone: 'trigger' | 'condition' | 'loud' | 'quiet';
  x: number;
  y: number;
  w: number;
  at: number;
  badge?: string;
  /** Which edges carry a connection port. */
  ports: ('top' | 'bottom')[];
}

const NODES: FlowNode[] = [
  {
    id: 'trigger',
    title: 'A new issue appears',
    detail: 'first seen in checkout-api',
    tone: 'trigger',
    x: 150,
    y: 10,
    w: 260,
    at: 0,
    badge: 'When',
    ports: ['bottom'],
  },
  {
    id: 'condition',
    // Short enough to survive the narrow column without truncating. A
    // condition that ends in an ellipsis is a condition the reader cannot
    // check, which defeats the point of setting it as code.
    title: 'level >= error',
    detail: 'and not muted',
    mono: true,
    tone: 'condition',
    x: 150,
    y: 126,
    w: 260,
    at: 0.2,
    badge: 'If',
    ports: ['top', 'bottom'],
  },
  {
    id: 'slack',
    title: 'Slack',
    detail: '#eng-oncall',
    tone: 'loud',
    x: 8,
    y: 272,
    w: 250,
    at: 0.48,
    ports: ['top', 'bottom'],
  },
  {
    id: 'digest',
    title: 'Daily digest',
    detail: 'one email, 09:00',
    tone: 'quiet',
    x: 302,
    y: 272,
    w: 250,
    at: 0.56,
    ports: ['top'],
  },
  {
    id: 'page',
    title: 'PagerDuty',
    detail: 'wakes whoever is on call',
    tone: 'loud',
    x: 8,
    y: 392,
    w: 250,
    at: 0.82,
    ports: ['top'],
  },
];

/**
 * Wires, in design units. Elbows get a small quadratic corner: a hard right
 * angle at this stroke weight reads as a table border, a radius reads as a
 * wire.
 */
const WIRES: {
  d: string;
  at: number;
  tone?: 'quiet';
  label?: string;
  lx?: number;
  ly?: number;
}[] = [
  { d: 'M 280 64 V 126', at: 0.16 },
  {
    d: 'M 225 180 V 216 Q 225 232 209 232 H 149 Q 133 232 133 248 V 272',
    at: 0.34,
    label: 'true',
    lx: 152,
    ly: 210,
  },
  {
    d: 'M 335 180 V 216 Q 335 232 351 232 H 411 Q 427 232 427 248 V 272',
    at: 0.42,
    tone: 'quiet',
    label: 'false',
    lx: 344,
    ly: 210,
  },
  { d: 'M 133 326 V 392', at: 0.7, label: 'no ack in 15m', lx: 148, ly: 346 },
];

const TONE = {
  trigger: {
    card: 'border-primary/30',
    badge: 'bg-primary text-primary-foreground',
    port: 'bg-primary',
  },
  condition: {
    card: 'border-white/18',
    badge: 'bg-white/20 text-white/85',
    port: 'bg-white/45',
  },
  loud: {
    card: 'border-primary/25',
    badge: 'bg-primary text-primary-foreground',
    port: 'bg-primary',
  },
  quiet: {
    card: 'border-white/10',
    badge: 'bg-white/12 text-white/60',
    port: 'bg-white/25',
  },
} as const;

function NodeCard({
  node,
  progress,
  compact = false,
}: {
  node: FlowNode;
  progress: MotionValue<number>;
  compact?: boolean;
}) {
  const reduced = useReducedMotion();
  const tone = TONE[node.tone];
  const opacity = useTransform(
    progress,
    [node.at - 0.06, node.at + 0.05],
    [0.14, 1],
  );
  const y = useTransform(progress, [node.at - 0.06, node.at + 0.05], [8, 0]);

  return (
    <m.div
      className={compact ? 'relative' : 'absolute'}
      style={{
        ...(compact
          ? {}
          : {
              left: `${(node.x / DESIGN_W) * 100}%`,
              top: `${(node.y / DESIGN_H) * 100}%`,
              width: `${(node.w / DESIGN_W) * 100}%`,
            }),
        ...(reduced ? {} : { opacity, y }),
      }}
    >
      {node.badge ? (
        <span
          className={cn(
            'absolute -top-1.5 left-2.5 z-10 rounded px-1.5 py-px font-mono text-[9px] uppercase tracking-wider',
            tone.badge,
          )}
        >
          {node.badge}
        </span>
      ) : null}

      <div
        className={cn(
          'relative rounded-lg border bg-[var(--card)] px-3 py-2 shadow-[0_16px_36px_-24px_rgba(0,0,0,0.9)]',
          tone.card,
        )}
      >
        {/* The ports. A wire lands on one of these, which is what makes the
            graph read as wired together rather than as boxes near lines. */}
        {compact
          ? null
          : node.ports.map((port) => (
              <span
                key={port}
                aria-hidden
                className={cn(
                  'absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full ring-2 ring-[var(--surface)]',
                  tone.port,
                  port === 'top' ? '-top-[3px]' : '-bottom-[3px]',
                )}
              />
            ))}

        <p
          className={cn(
            'truncate',
            node.mono
              ? 'font-mono text-[12px] text-foreground'
              : 'text-[13px] font-medium text-foreground',
          )}
        >
          {node.title}
        </p>
        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
          {node.detail}
        </p>
      </div>
    </m.div>
  );
}

function Wire({
  wire,
  progress,
}: {
  wire: (typeof WIRES)[number];
  progress: MotionValue<number>;
}) {
  const reduced = useReducedMotion();
  /* Motion drives `pathLength` by writing the dash attributes itself, which is
     what lets it draw any path without measuring one. */
  const drawn = useTransform(progress, [wire.at, wire.at + 0.12], [0, 1]);

  return (
    <m.path
      d={wire.d}
      pathLength={1}
      fill="none"
      stroke={
        wire.tone === 'quiet' ? 'rgba(255,255,255,0.22)' : 'var(--primary)'
      }
      strokeWidth={1.25}
      strokeLinecap="round"
      style={reduced ? { pathLength: 1 } : { pathLength: drawn }}
    />
  );
}

/** What a rule can match on, and where it can end up. The actual substance. */
const MATCH = ['First seen', 'Regression', 'Spike', 'Level', 'Project'];
const SEND = ['Slack', 'Discord', 'PagerDuty', 'Email', 'Webhook'];

export function Alerts() {
  const reduced = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: track,
    offset: ['start 0.9', 'end 0.7'],
  });
  const draw = useTransform(scrollYProgress, [0, 0.95], [0, 1], {
    clamp: true,
  });
  const labelOpacity = useTransform(draw, [0.3, 0.45], [0, 1]);

  return (
    <Band>
      <div
        ref={track}
        /*
          The prose takes the free track and the drawing takes a fixed, narrow
          one. It was the other way round, and that is what left the graph
          adrift in a field of dots: a column sized by "whatever is left over"
          is a column with no reason to be any particular width, so the thing
          inside it floats. Sizing the diagram's column to the diagram makes the
          dots a backing rather than a moat, and hands every spare pixel to the
          half of the section that actually says something.
        */
        className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,29rem)]"
      >
        {/* The substance lives here, not in the picture. */}
        <Cell className="border-rule lg:border-r">
          <Pill>Alerts</Pill>
          <Heading
            className="display-md mt-6 max-w-[30ch]"
            lead="Alert rules with conditions and escalation."
            rest="A rule decides what fires it, what it checks before firing, and where it goes. If nobody acknowledges it, it escalates on its own."
            scrub
          />

          <dl className="mt-9 space-y-6">
            <div>
              <dt className="eyebrow">Fires on</dt>
              <dd className="mt-2.5 flex flex-wrap gap-1.5">
                {MATCH.map((item) => (
                  <span
                    key={item}
                    className="rounded-md border border-white/12 px-2 py-1 text-[12.5px] text-white/70"
                  >
                    {item}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Reaches</dt>
              <dd className="mt-2.5 flex flex-wrap gap-1.5">
                {SEND.map((item) => (
                  <span
                    key={item}
                    className="rounded-md border border-white/12 px-2 py-1 text-[12.5px] text-white/70"
                  >
                    {item}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        </Cell>

        {/*
          The drawing. Centred in its column and capped well below the column's
          width: sized to the graph, not to the space available.
        */}
        <div className="relative flex items-center overflow-hidden bg-[var(--surface)] px-4 py-9 sm:px-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-55 [background-image:radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1px)] [background-size:18px_18px]"
          />

          <div
            className="relative mx-auto hidden w-full lg:block"
            style={{ aspectRatio: `${DESIGN_W} / ${DESIGN_H}` }}
          >
            <svg
              aria-hidden
              className="absolute inset-0 h-full w-full overflow-visible"
              viewBox={`0 0 ${DESIGN_W} ${DESIGN_H}`}
              fill="none"
            >
              <title>Alert rule</title>
              {WIRES.map((wire) => (
                <Wire key={wire.d} wire={wire} progress={draw} />
              ))}
            </svg>

            {/* The `true`/`false` pair is the one detail that turns a set of
                connected boxes into a rule you can read. */}
            {WIRES.filter((wire) => wire.label).map((wire) => (
              <m.span
                key={wire.label}
                className="absolute rounded bg-[var(--surface)] px-1 font-mono text-[9px] text-white/40"
                style={{
                  left: `${((wire.lx ?? 0) / DESIGN_W) * 100}%`,
                  top: `${((wire.ly ?? 0) / DESIGN_H) * 100}%`,
                  /* Reduced motion resolves the cards and the wires to their
                     finished state, and these have to resolve with them. Left
                     on the scrubbed value they were the one part of a diagram
                     drawn complete that stayed blank until the reader scrolled
                     far enough — and they are the part that turns connected
                     boxes into a rule you can read. */
                  opacity: reduced ? 1 : labelOpacity,
                }}
              >
                {wire.label}
              </m.span>
            ))}

            {NODES.map((node) => (
              <NodeCard key={node.id} node={node} progress={draw} />
            ))}
          </div>

          {/* Stacked below `lg`: a 560px canvas at phone width sets these
              labels at four pixels. */}
          <ol className="relative mx-auto flex w-full max-w-sm flex-col gap-2.5 lg:hidden">
            {NODES.map((node) => (
              <li key={node.id}>
                <NodeCard node={node} progress={draw} compact />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Band>
  );
}
