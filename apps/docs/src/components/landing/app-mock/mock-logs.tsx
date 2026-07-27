'use client';

import { ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { EASE } from '../motion';
import { useCompact } from './design';
import type { LogLevel, MockLog } from './fixtures';
import { LOGS, logAge } from './fixtures';
import {
  MockBadge,
  MockPageHead,
  MockShell,
  MockTh,
  usePad,
} from './mock-shell';
import { Beacon, Enter, MockStage, Settle, useIdleStep } from './stage';

/**
 * Structured logs, recreated from
 * apps/webview-ui/src/app/(main)/projects/[id]/logs/logs-list.tsx.
 *
 * Two details carry the argument and are easy to lose:
 *
 * The levels are the OTel set — `trace` through `fatal`, with `warn` rather
 * than `warning`. They come through the protocol untouched, which is the claim
 * the section makes, so writing a friendlier set here would quietly contradict
 * it.
 *
 * A row expands in place to its typed attribute map. That is the difference
 * between a log viewer and a `tail -f`: the structure the SDK sent is still
 * there, keyed and typed, sitting under the line it belongs to.
 */

const LEVELS: Array<'All' | LogLevel> = [
  'All',
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
];

/** `levelTone` from logs-list.tsx — an outlined badge, tinted by severity. */
function levelTone(level: LogLevel): string {
  switch (level) {
    case 'fatal':
      return 'border-destructive/40 bg-destructive/15 text-destructive';
    case 'error':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    case 'warn':
      return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-500';
    case 'info':
      return 'border-primary/30 bg-primary/10 text-primary';
    case 'debug':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-400';
    default:
      return 'border-muted-foreground/20 bg-muted text-muted-foreground';
  }
}

/** The row that is open, showing what a log line actually carries. */
function ExpandedRow({ log }: { log: (typeof LOGS)[number] }) {
  const compact = useCompact();

  return (
    <div className="bg-muted/20">
      <div className="space-y-4 px-5 py-4">
        <dl className="grid grid-cols-[5.5rem_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">timestamp</dt>
          <dd className="font-mono text-xs">{log.timestamp}</dd>
          <dt className="text-muted-foreground">trace_id</dt>
          <dd className="break-all font-mono text-xs">{log.traceId}</dd>
          <dt className="text-muted-foreground">severity</dt>
          <dd className="font-mono text-xs">{log.severityNumber}</dd>
        </dl>

        <div>
          <div className="mb-3 h-px bg-border" />
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Attributes
          </p>
          <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border">
            {log.attributes.map((attribute, index) => (
              <Enter
                key={attribute.key}
                index={index}
                delay={0.45}
                className={cn(
                  'grid items-start gap-3 bg-background px-3 py-1.5',
                  compact
                    ? 'grid-cols-[8rem_1fr_auto]'
                    : 'grid-cols-[12rem_1fr_auto]',
                )}
              >
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {attribute.key}
                </span>
                <span className="break-all font-mono text-xs">
                  {attribute.value}
                </span>
                <MockBadge className="text-[10px]">{attribute.type}</MockBadge>
              </Enter>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** One line of the table, in whichever slot it currently occupies. */
function Row({
  log,
  row,
  expanded = false,
}: {
  log: MockLog;
  row: number;
  expanded?: boolean;
}) {
  // The trace id is the column to lose first: it is a handle for jumping
  // somewhere else, and the message is the line itself.
  const compact = useCompact();

  return (
    <div
      className={cn(
        'flex h-9 items-center px-4',
        compact ? 'gap-2.5' : 'gap-4',
        expanded && 'bg-muted/40',
      )}
    >
      <ChevronRight
        className={cn('size-4 text-muted-foreground', expanded && 'rotate-90')}
      />
      <span className={compact ? 'w-16' : 'w-20'}>
        <span
          className={cn(
            'flex w-full items-center justify-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
            levelTone(log.level),
          )}
        >
          {log.level}
        </span>
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-sm">
        {log.body}
      </span>
      {compact ? null : (
        <span className="w-36 font-mono text-xs text-muted-foreground">
          {log.traceId ? (
            `${log.traceId.slice(0, 8)}…`
          ) : (
            <span className="text-muted-foreground/50">—</span>
          )}
        </span>
      )}
      <span
        className={cn(
          'whitespace-nowrap text-right text-xs text-muted-foreground',
          compact ? 'w-16' : 'w-32',
        )}
      >
        {logAge(row)}
      </span>
    </div>
  );
}

/** Rows below the expanded one: fixed slots the tail passes through. */
const SLOTS = [1, 2, 3, 4, 5, 6, 7];

/** How long a line holds a slot before the next one pushes it up. */
const TAIL_INTERVAL = 2600;

export function MockLogs() {
  const compact = useCompact();
  const [open, ...pool] = LOGS;

  // The idle phase of this screen. A log view is the one surface where being
  // static is not a stylistic choice but a wrong claim: the whole argument of
  // the section is that lines are arriving. `useIdleStep` holds its position
  // whenever the screen is off centre, so nothing advances unwatched.
  const step = useIdleStep(TAIL_INTERVAL, pool.length);
  const tail = SLOTS.map((_, i) => pool[(step + i) % pool.length]);

  return (
    <MockStage>
      <MockShell active="Logs">
        <MockPageHead
          title="Logs"
          subtitle={
            compact
              ? 'Structured logs for checkout-api'
              : 'Structured logs for checkout-api, on the same timeline as its errors'
          }
        />

        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden py-6',
            usePad(),
          )}
        >
          <Settle className="flex shrink-0 flex-wrap items-center justify-between gap-3 pb-3">
            {/* All seven levels stay, at any width. The claim the section makes
                is that the OTel set arrives untouched, so a narrow layout that
                quietly showed four of them would be arguing against itself. */}
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
              {LEVELS.map((level) => (
                <span
                  key={level}
                  className={cn(
                    'flex h-7 items-center rounded-md text-sm font-medium capitalize',
                    compact ? 'px-1.5' : 'px-3',
                    level === 'All'
                      ? 'bg-secondary text-secondary-foreground shadow-xs'
                      : 'text-muted-foreground',
                  )}
                >
                  {level}
                </span>
              ))}
            </div>
            <span className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
              <Beacon className="bg-primary" />
              1–8 of 1,284
            </span>
          </Settle>

          <Settle
            delay={0.1}
            className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border"
          >
            <div
              className={cn(
                'flex items-center border-b border-border bg-muted/50 px-4 py-2.5',
                compact ? 'gap-2.5' : 'gap-4',
              )}
            >
              <span className="w-4" />
              <MockTh className={compact ? 'w-16' : 'w-20'}>Level</MockTh>
              <MockTh className="flex-1">Message</MockTh>
              {compact ? null : <MockTh className="w-36">Trace</MockTh>}
              <MockTh className={cn('text-right', compact ? 'w-16' : 'w-32')}>
                Time
              </MockTh>
            </div>

            {/* The expanded row is the one you clicked, so it stays put while
                the tail runs underneath it. */}
            <Enter index={0} delay={0.25}>
              <Row log={open} row={0} expanded />
              <ExpandedRow log={open} />
            </Enter>

            {SLOTS.map((slot) => (
              <Enter
                // Keyed by slot, not by line: the wrapper is a fixed position
                // in the table that different lines pass through, so keying it
                // by content would remount the scroll entry on every tick.
                key={slot}
                index={slot}
                delay={0.25}
                className="relative h-9 border-t border-border"
              >
                <AnimatePresence initial={false}>
                  <motion.div
                    key={tail[slot - 1].id}
                    className="absolute inset-0"
                    initial={{ opacity: 0, y: 9 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -9 }}
                    transition={{ duration: 0.5, ease: EASE }}
                  >
                    <Row log={tail[slot - 1]} row={slot} />
                  </motion.div>
                </AnimatePresence>
              </Enter>
            ))}
          </Settle>

          <div className="flex shrink-0 items-center justify-end gap-2 pt-4 text-sm">
            <span className="px-1 tabular-nums">Page 1 of 161</span>
          </div>
        </div>
      </MockShell>
    </MockStage>
  );
}
