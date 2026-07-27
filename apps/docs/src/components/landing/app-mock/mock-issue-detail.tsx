'use client';

import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Copy,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompact } from './design';
import { MockButton, MockPill, MockShell, usePad } from './mock-shell';
import { Enter, MockStage, Settle, Ticker, Wipe } from './stage';

/**
 * A single event, recreated from
 * `projects/[id]/issues/[issueId]/events/[eventId]/page.tsx`.
 *
 * Two things here are easy to get wrong and matter most:
 *
 * The page is **collapsible sections**, not tabs. Sentry-style `<details>`
 * blocks stacked in one card, with a "Jump to" nav that scrolls between them —
 * so everything about the event is on one page rather than hidden behind six
 * clicks. Drawing it as a tab bar would misrepresent how the screen works.
 *
 * The failing line is highlighted in **brand green**, not red. In-app frames
 * are the ones you can act on, so the app marks them with the accent and dims
 * everything else to 60%; the red is spent on the severity badge, where it
 * means severity. A red-striped code block is the single most common way a
 * recreated stack trace gives itself away.
 *
 * The screen is drawn scrolled to the stack trace: the header band and the
 * event bar both stick in the real page, so this is what it actually looks like
 * once you have reached the frame that failed.
 */

type Tone = 'kw' | 'fn' | 'var' | 'str' | 'punc' | 'type' | 'plain' | 'comment';

/** vscDarkPlus, the theme `StackFrameItem` passes to react-syntax-highlighter. */
const TONE: Record<Tone, string> = {
  kw: '#569CD6',
  fn: '#DCDCAA',
  var: '#9CDCFE',
  str: '#CE9178',
  punc: '#D4D4D4',
  type: '#4EC9B0',
  plain: '#D4D4D4',
  comment: '#6A9955',
};

type Token = [Tone, string];

interface CodeLine {
  n: number;
  tokens: Token[];
  hit?: boolean;
}

const CONTEXT: CodeLine[] = [
  {
    n: 138,
    tokens: [
      ['kw', 'export async function '],
      ['fn', 'validateSession'],
      ['punc', '('],
      ['var', 'token'],
      ['punc', ': '],
      ['type', 'string'],
      ['punc', ') {'],
    ],
  },
  {
    n: 139,
    tokens: [
      ['punc', '  '],
      ['kw', 'const '],
      ['var', 'claims'],
      ['punc', ' = '],
      ['kw', 'await '],
      ['fn', 'verifyJwt'],
      ['punc', '('],
      ['var', 'token'],
      ['punc', ', '],
      ['var', 'publicKey'],
      ['punc', ');'],
    ],
  },
  { n: 140, tokens: [] },
  {
    n: 141,
    tokens: [
      ['punc', '  '],
      ['comment', '// Evicted after 15m; a long request can outlive it.'],
    ],
  },
  {
    n: 142,
    tokens: [
      ['punc', '  '],
      ['kw', 'const '],
      ['var', 'user'],
      ['punc', ' = '],
      ['var', 'sessions'],
      ['punc', '.'],
      ['fn', 'get'],
      ['punc', '('],
      ['var', 'claims'],
      ['punc', '.'],
      ['var', 'sub'],
      ['punc', ');'],
    ],
  },
  {
    n: 143,
    hit: true,
    tokens: [
      ['punc', '  '],
      ['kw', 'return '],
      ['punc', '{ '],
      ['var', 'id'],
      ['punc', ': '],
      ['var', 'user'],
      ['punc', '.'],
      ['var', 'id'],
      ['punc', ', '],
      ['var', 'email'],
      ['punc', ': '],
      ['var', 'user'],
      ['punc', '.'],
      ['var', 'email'],
      ['punc', ' };'],
    ],
  },
  { n: 144, tokens: [['punc', '}']] },
];

interface Frame {
  index: number;
  fn: string;
  location: string;
  inApp: boolean;
  expanded?: boolean;
}

/**
 * Newest frame first, which is what `orderFramesForDisplay` does for every
 * platform except Python — so the frame that threw is the one you land on,
 * already expanded, and the runtime frames trail off below it. The number is
 * the frame's position in protocol order (oldest-to-newest), which is why it
 * counts *down* the list.
 */
const FRAMES: Frame[] = [
  {
    index: 3,
    fn: 'validateSession',
    location: 'src/services/auth-provider.ts:143:22',
    inApp: true,
    expanded: true,
  },
  {
    index: 2,
    fn: 'handleRequest',
    location: 'src/http/router.ts:88:14',
    inApp: true,
  },
  {
    index: 1,
    fn: 'Server.emit',
    location: 'node:events:518:28',
    inApp: false,
  },
];

const HIGHLIGHTS: Array<[string, string, boolean?]> = [
  ['handled', 'no'],
  ['level', 'error'],
  ['transaction', 'POST /v1/orders', true],
  ['url', 'https://api.example.com/v1/orders', true],
  ['environment', 'production'],
  ['release', 'checkout-api@2.14.0', true],
  ['runtime', 'node 22.9.0'],
  ['trace id', '9f58f1872ac04d1e', true],
];

const JUMPS = ['Highlights', 'Stack Trace', 'Breadcrumbs', 'Tags', 'Context'];

/** The `<details>` block every event section is built from. */
function Section({
  title,
  open = false,
  action,
  children,
}: {
  title: string;
  open?: boolean;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex select-none items-center gap-2 py-3">
        <ChevronRight
          className={cn('size-4 text-muted-foreground', open && 'rotate-90')}
        />
        <span className="flex-1 text-sm font-semibold">{title}</span>
        {action}
      </div>
      {open ? <div className="pb-5">{children}</div> : null}
    </div>
  );
}

/**
 * One line of frame context.
 *
 * The failing line's accent bar wipes down rather than appearing: the eye is
 * being pointed at one row out of seven, and a mark that draws itself is what
 * makes that read as an annotation rather than as part of the code.
 */
function Line({ line, index }: { line: CodeLine; index: number }) {
  return (
    <Enter
      index={index}
      delay={0.3}
      step={0.03}
      className={cn('relative flex', line.hit ? 'bg-primary/15' : 'opacity-60')}
    >
      {/* Placed last, once the code it points at has finished arriving. */}
      {line.hit ? (
        <Wipe
          delay={0.62}
          className="absolute inset-y-0 left-0 block w-[3px] bg-primary"
        />
      ) : null}

      <span
        className={cn(
          'w-12 shrink-0 select-none py-0.5 pl-3 pr-4 text-right',
          line.hit ? 'font-medium text-primary' : 'text-muted-foreground',
        )}
      >
        {line.n}
      </span>
      <span className="flex-1 whitespace-pre py-0.5 pr-4">
        {line.tokens.length === 0
          ? ' '
          : line.tokens.map((token, i) => (
              // Tokens are a fixed authored line, never reordered.
              <span key={i} style={{ color: TONE[token[0]] }}>
                {token[1]}
              </span>
            ))}
      </span>
    </Enter>
  );
}

/** `StackFrameItem` — one frame, expanded to its context when it is in-app. */
function StackFrame({ frame, order }: { frame: Frame; order: number }) {
  return (
    <Settle
      index={order}
      delay={0.15}
      className={cn(
        'overflow-hidden rounded-lg border',
        frame.inApp
          ? 'border-primary/40 bg-primary/5'
          : 'border-border bg-card/50 opacity-60',
      )}
    >
      <div className="flex items-center gap-4 px-4 py-3 text-left">
        <span
          className={cn(
            'font-mono text-xs',
            frame.inApp ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {String(frame.index).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-semibold">{frame.fn}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {frame.location}
          </p>
        </div>
        {frame.inApp ? (
          <span className="text-muted-foreground">
            {frame.expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </span>
        ) : null}
      </div>

      {frame.expanded ? (
        <div className="overflow-hidden bg-zinc-900 font-mono text-xs leading-relaxed">
          {CONTEXT.map((line, i) => (
            <Line key={line.n} line={line} index={i} />
          ))}
        </div>
      ) : null}
    </Settle>
  );
}

export function MockIssueDetail() {
  const compact = useCompact();
  const pad = usePad();

  return (
    <MockStage>
      <MockShell active="Issues">
        {/*
          Header — an elevated band, sticky above the scrolling body.

          The two blocks inside are `Settle`s rather than plain divs, and that
          was a real omission rather than a refinement. Everything below this
          header builds against the stage's scroll clock: the event card, the
          tab strip, the panels, the stack frames. The header did not, so it was
          simply present from the first frame — and once the chapter was reframed
          to open at the top of the page, that static block became the first
          190px a reader sees. The chapter looked like the one screen on the
          page that does not animate, when in fact only its lid did not.
        */}
        <header className="shrink-0 border-b border-border bg-card">
          <Settle className={cn('space-y-1.5 py-3', pad)}>
            <nav className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span>Issues</span>
              <span className="text-muted-foreground/40">/</span>
              <span className="truncate font-mono text-foreground">
                CHECKOUT-4F2
              </span>
            </nav>

            <div className="flex items-start justify-between gap-6">
              {/* Title is the exception *type*; the value goes on its own line
                  below, the way Sentry splits them. */}
              <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight">
                TypeError
              </h1>
              <div
                className={cn(
                  'flex shrink-0 items-start',
                  compact ? 'gap-4' : 'gap-8',
                )}
              >
                {/* The issue is escalating, which is what its substatus below
                    says; the totals keep climbing while you read it. */}
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Events (total)
                  </p>
                  <p className="text-xl font-semibold leading-tight tabular-nums">
                    <Ticker value={12412} delay={0.1} live={1.6} />
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Users
                  </p>
                  <p className="text-xl font-semibold leading-tight tabular-nums">
                    <Ticker value={842} delay={0.16} live={0.12} />
                  </p>
                </div>
              </div>
            </div>

            <div className="flex min-w-0 items-start gap-2 text-sm">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-500" />
              <p className="truncate font-mono text-foreground/90">
                Cannot read property &apos;id&apos; of undefined
              </p>
            </div>

            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <MockPill dot="bg-muted-foreground" label="Escalating" />
              <span className="truncate font-mono">
                services/auth_provider in validateSession
              </span>
            </div>
          </Settle>

          {/* Workflow toolbar — same elevated band as the header. Lands just
              after the block above, so the header assembles top to bottom
              rather than as one piece. */}
          <Settle
            delay={0.08}
            className={cn('border-t border-border py-2', pad)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex">
                <MockButton variant="default" className="rounded-r-none">
                  <Check className="size-4" />
                  Resolve
                </MockButton>
                <span className="flex h-8 items-center rounded-r-md border-l border-primary-foreground/20 bg-primary px-2 text-primary-foreground">
                  <ChevronDown className="size-4" />
                </span>
              </div>
              <MockButton>
                <Archive className="size-4" />
                Archive
              </MockButton>
              <MockButton className="w-8 justify-center px-0">
                <MoreHorizontal className="size-4" />
              </MockButton>
            </div>
          </Settle>
        </header>

        <div className={cn('min-h-0 flex-1 overflow-hidden py-5', pad)}>
          {/* Event bar — sticks to the top of the body as you scroll. The
              negative margin has to undo whichever gutter is in force. */}
          <Settle
            className={cn(
              'border-b border-border bg-background pb-3 pt-1',
              pad,
              compact ? '-mx-5' : '-mx-8',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm">
                <span className="font-semibold">Events</span>{' '}
                <span className="text-muted-foreground">in this issue</span>
              </p>
              <div className="flex items-center gap-2">
                <MockButton>Older</MockButton>
                <MockButton>Newer</MockButton>
                <MockButton variant="outline">Latest</MockButton>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex min-w-0 items-center gap-2">
                <span>
                  ID:{' '}
                  <span className="font-mono text-foreground">f104c953</span>
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span>2 minutes ago</span>
                {/* Platform and environment ride as bare chips here, without
                    the leading dot the status pill carries. */}
                {['node', 'production'].map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              {/* The jump nav is a convenience for a long page on a wide
                  screen. At this width it would be the widest thing in the bar
                  and would push the event id — the part that identifies what
                  you are looking at — off the row. */}
              {compact ? null : (
                <div className="flex shrink-0 items-center gap-3">
                  <span>Jump to:</span>
                  {JUMPS.map((jump) => (
                    <span key={jump}>{jump}</span>
                  ))}
                </div>
              )}
            </div>
          </Settle>

          {/* Sections — one card, `<details>` all the way down. */}
          <Settle
            delay={0.08}
            className="mt-5 rounded-lg border border-border bg-card px-4"
          >
            <Section title="Highlights" open>
              {/* One column at this width. Two would give each pair 230px, and
                  the values here — a URL, a release, a trace id — are the sort
                  that truncate to nothing. */}
              <div
                className={cn(
                  'grid gap-x-8',
                  compact ? 'grid-cols-1' : 'grid-cols-2',
                )}
              >
                {[HIGHLIGHTS.slice(0, 4), HIGHLIGHTS.slice(4)].map(
                  (column, columnIndex) => (
                    <dl key={columnIndex} className="text-sm">
                      {column.map(([label, value, mono], rowIndex) => (
                        <div
                          key={label}
                          className={cn(
                            'flex items-center gap-4 rounded px-2 py-1.5',
                            rowIndex % 2 === 0 && 'bg-muted/40',
                          )}
                        >
                          <dt className="w-28 shrink-0 text-muted-foreground">
                            {label}
                          </dt>
                          <dd
                            className={cn(
                              'min-w-0 truncate',
                              mono && 'font-mono text-xs',
                            )}
                          >
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ),
                )}
              </div>
            </Section>

            <Section
              title="Stack Trace"
              open
              action={
                <MockButton variant="outline" className="h-7 text-xs">
                  <Copy className="size-3.5" />
                  Copy as
                  <ChevronDown className="size-3.5" />
                </MockButton>
              }
            >
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-destructive">
                    TypeError
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Cannot read property &apos;id&apos; of undefined
                  </p>
                </div>

                <div className="space-y-2">
                  {FRAMES.map((frame, order) => (
                    <StackFrame key={frame.fn} frame={frame} order={order} />
                  ))}
                </div>
              </div>
            </Section>

            <Section title="Breadcrumbs" />
            <Section title="Tags" />
            <Section title="Context" />
          </Settle>
        </div>
      </MockShell>
    </MockStage>
  );
}
