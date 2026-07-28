'use client';

import {
  Bell,
  ChevronRight,
  CircleAlert,
  Globe,
  Hash,
  type LucideIcon,
  Mail,
  MessageSquare,
  MousePointerClick,
  Navigation,
  Webhook,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EASE } from '../motion';
import { TrendSparkline } from './charts';
import type { LogLevel, Priority } from './fixtures';
import { ISSUES, LOGS } from './fixtures';
import { MockLevel, MockPill } from './mock-shell';
import {
  Enter,
  MockStage,
  Rise,
  Settle,
  Ticker,
  useIdleStep,
  Wipe,
} from './stage';

/**
 * The small visuals that sit in the two-up rows.
 *
 * ── What these are now, and what they were ──────────────────────────────────
 *
 * They are fragments of the product, drawn at the product's own size.
 *
 * They used to be diagrams *about* the product, and the tell was the type. Every
 * one of them was set at 9.5 to 11.5px on a hand-mixed `oklch(0.135 0 0)` card
 * with `border-white/10` and labels in `text-white/30` — a palette that appears
 * nowhere in the application and a scale two to three steps below anything it
 * renders. The big screens on the same page are built out of `bg-card`,
 * `ring-foreground/10`, `text-sm` and `text-muted-foreground`, so the two sat
 * side by side making opposite claims: the surface said "this is the product"
 * and the visual under it said "this is an illustration of the product".
 *
 * So each one is now the real component from the real screen, named in its
 * doc comment, using the app's tokens and the app's type scale. Nothing here is
 * invented: if a value is shown, the app shows that value, in that place, at
 * that size.
 *
 * ── Scrubbed, like everything else ──────────────────────────────────────────
 *
 * They run on the same clock the full screens do. `MockStage` publishes one
 * progress value per mini as it crosses the viewport and every mark inside is a
 * function of it, so scrolling back up plays the assembly backwards. See
 * `stage.tsx`. The one exception is a genuine idle loop — the log tail, which
 * has to keep producing lines once it has arrived, because a stream that
 * freezes is a screenshot.
 */

/**
 * The app's `Card`, which is what every one of these actually is.
 *
 * A ring rather than a border, matching `MockCard` and the product: the app's
 * cards are `ring-1 ring-foreground/10` over `bg-card`, which sits fractionally
 * inside the rounded corner and reads softer than a 1px border at the same
 * opacity.
 *
 * `min-w-0` is doing real work here, not decoration. These sit in grid cells,
 * and a grid item's automatic minimum is its content's — so a row of fixed
 * columns inside one would push the cell wider than its track, then the track
 * wider than the page. Floored at 0, the card keeps the width it was given and
 * the rows inside it shrink or truncate, which is what they were written to do.
 */
function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <MockStage className="min-w-0">
      <Settle
        className={cn(
          'min-w-0 overflow-hidden rounded-xl bg-card p-4 text-sm text-card-foreground shadow-xs ring-1 ring-foreground/10',
          className,
        )}
      >
        {children}
      </Settle>
    </MockStage>
  );
}

/** The tile label the app puts above every card's contents. */
function PanelLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Issues                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * `statusDisplay` / `priorityDisplay` from lib/issue-status.ts.
 *
 * Keyed on the fixture's own union rather than on `string`. Widened, a renamed
 * priority still compiles and resolves to `undefined` at runtime, which for a
 * class name is a dot that silently loses its colour.
 */
const STATUS_DOT = 'bg-muted-foreground';
const PRIORITY_DOT: Record<Priority, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-sky-500',
};

/** A fixed decorative run. Authored, not derived, so it lives at module scope. */
const GROUPING_BARS = [62, 100, 44, 78, 30, 92, 55, 70, 38, 84, 48, 66];

/**
 * Many events, one issue.
 *
 * The raw run collapses into a single row, and the row is the real one — the
 * issue list's, from
 * apps/webview-ui/src/app/(main)/projects/[id]/issues/issues-list.tsx, with the
 * indicator strip the product shows: status and priority as dots on a muted
 * pill, severity as the one thing allowed colour, then the culprit, the short
 * id, the trend and the count.
 *
 * That fidelity is the argument. The claim is "the same exception from a
 * thousand sessions is a single issue with a count", and the most convincing
 * way to make it is to show the reader the actual row they will be looking at,
 * with the actual count running up into it.
 */
export function GroupingMini() {
  const issue = ISSUES[0];

  return (
    <Panel>
      <PanelLabel>Raw events</PanelLabel>

      {/* The unstructured run, in the severity colour the app's volume chart
          uses for errors. Deliberately the only abstract mark left in these
          minis: it stands for "a great many events", which is a quantity and
          not a component. */}
      <div className="mt-3 flex h-9 items-end gap-1">
        {GROUPING_BARS.map((height, index) => (
          // react-doctor-disable-next-line react-doctor/no-array-index-as-key
          <Rise
            // A fixed decorative run.
            key={index}
            delay={index * 0.03}
            className="flex-1 rounded-[2px] opacity-55"
            style={{ height: `${height}%`, background: 'var(--sev-error)' }}
          />
        ))}
      </div>

      <div className="my-4 flex items-center gap-2.5 font-mono text-xs text-muted-foreground/70">
        <span className="h-px flex-1 bg-border" />
        fingerprint
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* `issues-list.tsx`, one row: the same markup, the same order, the same
          restraint about which of the five indicators is allowed to be loud. */}
      <Enter delay={0.5} className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="mb-1 truncate font-semibold">{issue.title}</p>
          <p className="mb-1.5 truncate font-mono text-xs text-muted-foreground/70">
            {issue.culprit}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <MockPill dot={STATUS_DOT} label={issue.substatus} />
            {issue.priority ? (
              <MockPill
                dot={PRIORITY_DOT[issue.priority]}
                label={
                  issue.priority[0].toUpperCase() + issue.priority.slice(1)
                }
              />
            ) : null}
            <MockLevel level={issue.level} />
            <span className="font-mono text-muted-foreground/70">
              {issue.shortId}
            </span>
          </div>
        </div>

        <div className="hidden w-16 shrink-0 justify-start sm:flex">
          <TrendSparkline trend={issue.trend} delay={0.6} live />
        </div>

        {/* The count is the whole point of the fold, so it is the one figure
            that counts up rather than appearing. */}
        <span className="w-16 shrink-0 text-right font-mono text-sm">
          <Ticker value={issue.events} delay={0.55} />
        </span>
      </Enter>
    </Panel>
  );
}

/**
 * `ProviderIcon` from the alerts settings, for the providers this rule uses.
 *
 * The map is the authority and `ROUTES` is checked against it, rather than the
 * other way round: this is the app's whole set, and a route naming something
 * outside it is the error. Widened to `Record<string, LucideIcon>` that error
 * compiles and lands as `<Icon />` on `undefined`, which is not a missing dot
 * but a thrown render.
 */
const PROVIDER_ICON = {
  slack: Hash,
  discord: MessageSquare,
  pagerduty: Bell,
  email: Mail,
  webhook: Webhook,
} as const satisfies Record<string, LucideIcon>;

type Provider = keyof typeof PROVIDER_ICON;

/**
 * `Switch` at `size="sm"` — h-14px, w-24px, a size-3 thumb, `bg-primary` when
 * checked and `bg-input` when it is not.
 */
function MockSwitch({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        'relative inline-flex h-[14px] w-[24px] shrink-0 items-center rounded-full border border-transparent shadow-xs',
        checked ? 'bg-primary' : 'bg-input',
      )}
    >
      <span
        className={cn(
          'block size-3 rounded-full',
          checked
            ? 'translate-x-[calc(100%-2px)] bg-primary-foreground'
            : 'translate-x-0 bg-foreground',
        )}
      />
    </span>
  );
}

const ROUTES = [
  { name: 'eng-oncall', provider: 'slack', on: true },
  { name: 'Platform escalation', provider: 'pagerduty', on: true },
  { name: 'oncall@acme.dev', provider: 'email', on: false },
  { name: 'Ops runbook', provider: 'webhook', on: false },
] as const satisfies readonly {
  name: string;
  provider: Provider;
  on: boolean;
}[];

/**
 * Where an alert lands once a rule fires — the integration toggle from
 * apps/webview-ui/src/app/(main)/projects/[id]/settings/alerts/alerts-settings.tsx.
 *
 * Recreated down to the rule that card follows, which is easy to miss and is
 * the reason it looks like settings rather than like a feature list: the card's
 * background never changes, only its border. Selected means `border-primary/50`
 * and an icon chip lifted to `bg-primary/10 text-primary`; unselected is
 * `border-border` and a muted chip. Two of the four are off, because a settings
 * screen where everything is enabled is a diagram of a settings screen.
 *
 * Above them, the trigger the rule fires on — `alert_type` is one of
 * `new_issue`, `regression` or `unmute`, and those are the three shown.
 */
export function AlertRoutesMini() {
  return (
    <Panel>
      <PanelLabel>Trigger</PanelLabel>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {[
          { label: 'New issue', on: true },
          { label: 'Regression', on: true },
          { label: 'Unmute', on: false },
        ].map((trigger, index) => (
          <Enter key={trigger.label} index={index} step={0.05}>
            <span
              className={cn(
                'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                trigger.on
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground',
              )}
            >
              {trigger.label}
            </span>
          </Enter>
        ))}
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <PanelLabel>Send to</PanelLabel>
        <div className="mt-2.5 space-y-2">
          {ROUTES.map((route, index) => {
            const Icon = PROVIDER_ICON[route.provider];
            return (
              <Enter
                key={route.name}
                index={index}
                delay={0.2}
                step={0.07}
                className={cn(
                  'flex items-center justify-between rounded-lg border bg-card px-3 py-2.5',
                  route.on ? 'border-primary/50' : 'border-border',
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-md',
                      route.on
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium leading-none">
                      {route.name}
                    </p>
                    <p className="mt-0.5 text-[10px] capitalize text-muted-foreground">
                      {route.provider}
                    </p>
                  </div>
                </div>
                <MockSwitch checked={route.on} />
              </Enter>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Stack traces                                                                */
/* -------------------------------------------------------------------------- */

/** vscDarkPlus, the theme `StackFrameItem` passes to react-syntax-highlighter. */
const CODE = {
  keyword: 'text-[#569cd6]',
  fn: 'text-[#dcdcaa]',
  string: 'text-[#ce9178]',
  plain: 'text-[#d4d4d4]',
  muted: 'text-[#6a9955]',
} as const;

/**
 * The frame a source map resolves back to — `StackFrameItem` from
 * apps/webview-ui/src/app/(main)/projects/[id]/issues/[issueId]/events/[eventId]/stack-frame-item.tsx.
 *
 * The whole component, not a paraphrase of it: the zero-padded index in mono,
 * the function name above its location, the chevron an expandable frame
 * carries, and the code context on `bg-zinc-900` with the culprit line washed in
 * `bg-primary/15` behind a 3px accent bar. In-app frames are
 * `border-primary/40 bg-primary/5`; everything else is dimmed to 60%, which is
 * how the product says "this one is yours and those are not".
 *
 * The minified frame above it is the argument. It is the same frame before the
 * map was applied, struck through, so the reader sees what they would have had
 * to work with — and this is the one place a landing may show a struck-out line,
 * because the product genuinely replaces one with the other.
 */
export function StackFrameMini() {
  return (
    <Panel>
      <PanelLabel>Before</PanelLabel>
      <p className="mt-2 truncate font-mono text-xs text-muted-foreground line-through">
        main.4f2c9b.js in n:1:28471
      </p>

      <div className="mt-4 space-y-2">
        {/* A dimmed vendor frame, so the accented one below has something to be
            distinguished from. One frame in isolation cannot show a contrast
            that only exists between frames. */}
        <Enter
          delay={0.25}
          className="overflow-hidden rounded-lg border border-border bg-card/50 opacity-60"
        >
          <div className="flex items-center gap-4 px-4 py-3">
            <span className="font-mono text-xs text-muted-foreground">04</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-sm font-semibold">
                dispatchRequest
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                node_modules/axios/lib/core/dispatchRequest.js:51
              </p>
            </div>
          </div>
        </Enter>

        <Enter
          delay={0.4}
          className="overflow-hidden rounded-lg border border-primary/40 bg-primary/5"
        >
          <div className="flex items-center gap-4 px-4 py-3">
            <span className="font-mono text-xs text-primary">03</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-sm font-semibold">
                validateSession
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                src/services/auth-provider.ts:143:22
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </div>

          <div className="overflow-hidden bg-zinc-900 font-mono text-xs leading-relaxed">
            <div className="flex opacity-60">
              <span className="w-12 shrink-0 select-none py-0.5 pl-3 pr-4 text-right text-muted-foreground">
                142
              </span>
              <span className="min-w-0 flex-1 truncate py-0.5 pr-4">
                <span className={CODE.keyword}>const</span>
                <span className={CODE.plain}> user = sessions.</span>
                <span className={CODE.fn}>get</span>
                <span className={CODE.plain}>(claims.sub)</span>
              </span>
            </div>

            <div className="relative flex bg-primary/15">
              <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" />
              <span className="w-12 shrink-0 select-none py-0.5 pl-3 pr-4 text-right font-medium text-primary">
                143
              </span>
              <span className="min-w-0 flex-1 truncate py-0.5 pr-4">
                <span className={CODE.keyword}>return</span>
                <span className={CODE.plain}>{' { id: user.id }'}</span>
              </span>
            </div>

            <div className="flex opacity-60">
              <span className="w-12 shrink-0 select-none py-0.5 pl-3 pr-4 text-right text-muted-foreground">
                144
              </span>
              <span className="min-w-0 flex-1 truncate py-0.5 pr-4">
                <span className={CODE.plain}>{'}'}</span>
              </span>
            </div>
          </div>
        </Enter>
      </div>
    </Panel>
  );
}

interface Crumb {
  category: string;
  message: string;
  at: string;
  level?: 'error';
  icon: LucideIcon;
}

/** `crumbIcon` picks these from the crumb's category; these are its answers. */
const TRAIL: Crumb[] = [
  {
    category: 'navigation',
    message: '/cart → /checkout',
    at: '14:22:02',
    icon: Navigation,
  },
  {
    category: 'http',
    message: 'GET /v1/cart/8814 · 200',
    at: '14:22:04',
    icon: Globe,
  },
  {
    category: 'ui.click',
    message: 'button#submit-order',
    at: '14:22:06',
    icon: MousePointerClick,
  },
  {
    category: 'http',
    message: 'POST /v1/orders · 500',
    at: '14:22:07',
    level: 'error',
    icon: CircleAlert,
  },
];

/**
 * What the user did in the seconds before the throw — `BreadcrumbTimeline` from
 * the event detail's breadcrumbs.tsx.
 *
 * The product draws this as a genuine timeline: a `size-7` ring node per crumb
 * with a hairline running between them, the category set small and tracked, the
 * time in mono at the right, the message at full size underneath. The previous
 * version of this mini was a flat four-row table with coloured dots, which is a
 * different component making a weaker claim — a list of things that happened,
 * rather than a sequence leading somewhere.
 *
 * The rail is what carries the argument, so it is drawn rather than revealed:
 * each segment wipes downward into the node below it, and the trail arrives
 * oldest first, so the sequence plays out in the order it happened and ends on
 * the request that failed.
 */
export function BreadcrumbsMini() {
  return (
    <Panel>
      <PanelLabel>Breadcrumbs</PanelLabel>

      <ol className="relative mt-3">
        {TRAIL.map((crumb, index) => {
          const Icon = crumb.icon;
          const isLast = index === TRAIL.length - 1;

          return (
            <li key={crumb.at} className="relative pb-4 last:pb-0">
              {/* The rail between this node and the next. Drawn downward with
                  `Wipe` rather than simply present, so the eye is led from one
                  crumb to the one that follows it instead of being shown a
                  ladder that was already there. Timed with the crumb it leaves,
                  so it arrives before the node it points at. */}
              {!isLast ? (
                <Wipe
                  delay={0.2 + index * 0.1}
                  className="absolute bottom-0 left-[13px] top-7 w-px bg-border"
                />
              ) : null}

              <Enter
                index={index}
                delay={0.15}
                step={0.1}
                className="flex gap-3"
              >
                <span
                  className={cn(
                    'relative flex size-7 shrink-0 items-center justify-center rounded-full border bg-card',
                    crumb.level === 'error' && 'border-destructive/40',
                  )}
                >
                  <Icon
                    className={cn(
                      'size-3.5',
                      crumb.level === 'error'
                        ? 'text-red-500'
                        : 'text-muted-foreground',
                    )}
                  />
                </span>

                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {crumb.category}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground/70">
                      {crumb.at}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-foreground">
                    {crumb.message}
                  </p>
                </div>
              </Enter>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Logs                                                                        */
/* -------------------------------------------------------------------------- */

/** `levelTone` from the logs list, verbatim. */
const LEVEL_TONE: Record<LogLevel, string> = {
  fatal: 'border-destructive/40 bg-destructive/15 text-destructive',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
  warn: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-500',
  info: 'border-primary/30 bg-primary/10 text-primary',
  debug: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  trace: 'border-muted-foreground/20 bg-muted text-muted-foreground',
};

const MINI_SLOTS = [0, 1, 2, 3, 4];

/**
 * Severity, exactly as the logs table badges it — OTel names included.
 *
 * The real row from
 * apps/webview-ui/src/app/(main)/projects/[id]/logs/logs-list.tsx: the
 * disclosure chevron a row carries because it expands, the level as a full-width
 * outline `Badge` in its `levelTone`, the body in mono, and the relative time on
 * the right. The badge column is fixed at `w-20` in the product and is fixed
 * here too, which is what makes six different level names line up instead of
 * ragging.
 *
 * Runs the same tail as the full screen. The claim is "levels come through the
 * protocol untouched", and a stream that keeps producing new ones makes it far
 * better than five frozen rows do — so this is the one mini with a genuine idle
 * loop rather than a pure scrub.
 */
export function LogLevelsMini() {
  const step = useIdleStep(2800, LOGS.length);

  return (
    <Panel className="p-0">
      {/* `TableHeader` on `bg-muted/50`, as the logs table draws it. */}
      <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <span className="w-4 shrink-0" />
        <span className="w-20 shrink-0">Level</span>
        <span className="min-w-0 flex-1">Message</span>
        <span className="hidden w-20 shrink-0 text-right sm:block">Time</span>
      </div>

      <div>
        {MINI_SLOTS.map((slot) => {
          const log = LOGS[(step + slot) % LOGS.length];
          return (
            <Enter
              // Keyed by slot: the row is a position lines pass through.
              key={slot}
              index={slot}
              delay={0.15}
              step={0.07}
              className="relative h-9 border-b border-border last:border-b-0"
            >
              <AnimatePresence initial={false}>
                <m.div
                  key={log.id}
                  className="absolute inset-0 flex items-center gap-3 px-4"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.45, ease: EASE }}
                >
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  <span
                    className={cn(
                      'inline-flex w-20 shrink-0 items-center justify-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                      LEVEL_TONE[log.level],
                    )}
                  >
                    {log.level}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-sm">
                    {log.body}
                  </span>
                  <span className="hidden w-20 shrink-0 whitespace-nowrap text-right text-xs text-muted-foreground sm:block">
                    {slot === 0 ? 'just now' : `${slot * 3 + 1}s ago`}
                  </span>
                </m.div>
              </AnimatePresence>
            </Enter>
          );
        })}
      </div>
    </Panel>
  );
}

/**
 * What the SDK attached, still keyed and still typed — the expanded log row's
 * attribute grid from the same file.
 *
 * The product's construction is the point and it is reproduced exactly: a
 * `grid gap-px` over `bg-border`, so the hairlines between rows are the backing
 * showing through the gaps rather than borders drawn on each cell. Every row is
 * `[key, value, type]` with the key muted, the value at full strength and the
 * type as a secondary `Badge`.
 *
 * This replaces a second copy of the breadcrumbs mini, which was doing duty for
 * a claim it does not make: a trail of user actions is not an argument about
 * attributes being stored as a typed map. The section says the SDK's attributes
 * survive as something you can filter on, and the thing that shows that is the
 * table where they are keyed and typed.
 */
export function AttributesMini() {
  const log = LOGS[0];

  return (
    <Panel>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'inline-flex w-20 shrink-0 items-center justify-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
            LEVEL_TONE[log.level],
          )}
        >
          {log.level}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-sm">
          {log.body}
        </span>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <PanelLabel>Attributes</PanelLabel>

        <div className="mt-2.5 grid gap-px overflow-hidden rounded-md border border-border bg-border">
          {log.attributes.map((attribute, index) => (
            <Enter
              key={attribute.key}
              index={index}
              delay={0.2}
              step={0.07}
              className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-3 bg-background px-3 py-1.5"
            >
              <span className="truncate font-mono text-xs text-muted-foreground">
                {attribute.key}
              </span>
              <span className="truncate font-mono text-xs">
                {attribute.value}
              </span>
              <span className="inline-flex shrink-0 items-center rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                {attribute.type}
              </span>
            </Enter>
          ))}
        </div>
      </div>
    </Panel>
  );
}
