'use client';

import { Bookmark, Check, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompact } from './app-frame';
import { TrendSparkline } from './charts';
import { ISSUES } from './fixtures';
import {
  MockLevel,
  MockPageHead,
  MockPill,
  MockShell,
  MockTh,
  usePad,
} from './mock-shell';
import { Enter, MockStage, Settle, Ticker } from './stage';

/**
 * The issue stream, recreated from
 * apps/webview-ui/src/app/(main)/projects/[id]/issues/issues-list.tsx.
 *
 * The row is the point of the screen, so it is reproduced whole: selection
 * checkbox, title, culprit, then the quiet indicator strip — status, priority,
 * level, platform, short id — followed by trend, age, events, users and last
 * seen. Status and priority are dots on a muted pill rather than saturated
 * badges; only severity earns colour. That restraint is the app's, and dropping
 * it would make the recreation louder than the product.
 */

const FILTERS = ['Open', 'Resolved', 'Muted', 'All'] as const;

/** `statusDisplay` / `priorityDisplay` from lib/issue-status.ts. */
const STATUS_DOT: Record<string, string> = {
  Escalating: 'bg-muted-foreground',
  Ongoing: 'bg-muted-foreground',
  New: 'bg-muted-foreground',
  Regressed: 'bg-muted-foreground',
};
const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-sky-500',
};

/** The `Checkbox` primitive, unchecked, as it sits in the header and rows. */
function MockCheckbox({ checked = false }: { checked?: boolean }) {
  return (
    <span
      className={cn(
        'grid size-4 shrink-0 place-items-center rounded-[4px] border',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-transparent',
      )}
    >
      {checked ? <Check className="size-3" strokeWidth={3} /> : null}
    </span>
  );
}

export function MockIssues() {
  /*
    Which columns survive the narrow design, and why these.

    A table cannot be scaled down, only shortened, so the choice is which four
    facts a phone gets. Title, trend and event count are the three the row is
    *for* — what broke, whether it is getting worse, and how much. Age, users
    and last-seen are the ones you sort by on a desktop and skim past on a
    phone, and the overflow menu opens something there is no room to open.
  */
  const compact = useCompact();

  return (
    <MockStage>
      <MockShell active="Issues">
        <MockPageHead
          title="Issues"
          subtitle={
            compact
              ? 'Grouped from 48,204 events'
              : 'Grouped from 48,204 events in the last 24 hours'
          }
        />

        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden py-6',
            usePad(),
          )}
        >
          {/* `Tabs` + `TabsList`: a segmented control on the muted surface. */}
          <Settle className="mb-4 shrink-0">
            <div className="inline-flex h-9 w-fit items-center gap-1 rounded-lg bg-muted p-1">
              {FILTERS.map((filter) => (
                <span
                  key={filter}
                  className={cn(
                    'flex h-7 items-center rounded-md px-3 text-sm font-medium',
                    filter === 'Open'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground',
                  )}
                >
                  {filter}
                </span>
              ))}
            </div>
          </Settle>

          <Settle
            delay={0.1}
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border"
          >
            <div className="flex shrink-0 items-center gap-4 border-b border-border bg-muted/50 px-4 py-3">
              <MockCheckbox />
              <MockTh className="flex-1">Issue</MockTh>
              <MockTh className="w-16">Trend</MockTh>
              {compact ? null : (
                <MockTh className="w-24 text-right">Age</MockTh>
              )}
              <MockTh
                className={compact ? 'w-16 text-right' : 'w-24 text-right'}
              >
                Events
              </MockTh>
              {compact ? null : (
                <>
                  <MockTh className="w-20 text-right">Users</MockTh>
                  <MockTh className="w-36 text-right">Last Seen</MockTh>
                  <span className="w-8" />
                </>
              )}
            </div>

            <div className="min-h-0 flex-1">
              {ISSUES.map((issue, index) => (
                <Enter
                  key={issue.shortId}
                  index={index}
                  delay={0.25}
                  className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <MockCheckbox />

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      {index === 0 ? (
                        <Bookmark className="size-4 shrink-0 fill-current text-primary" />
                      ) : null}
                      <span className="truncate font-semibold">
                        {issue.title}
                      </span>
                    </div>
                    <p className="mb-1.5 truncate font-mono text-xs text-muted-foreground/70">
                      {issue.culprit}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <MockPill
                        dot={STATUS_DOT[issue.substatus]}
                        label={issue.substatus}
                      />
                      {issue.priority ? (
                        <MockPill
                          dot={PRIORITY_DOT[issue.priority]}
                          label={
                            issue.priority[0].toUpperCase() +
                            issue.priority.slice(1)
                          }
                        />
                      ) : null}
                      <MockLevel level={issue.level} />
                      {compact ? null : <span>{issue.platform}</span>}
                      <span className="font-mono text-muted-foreground/70">
                        {issue.shortId}
                      </span>
                    </div>
                  </div>

                  <div className="flex w-16 justify-start">
                    <TrendSparkline
                      trend={issue.trend}
                      delay={0.3 + index * 0.045}
                      live={issue.substatus === 'Escalating'}
                    />
                  </div>

                  {compact ? null : (
                    <span className="w-24 whitespace-nowrap text-right text-sm text-muted-foreground">
                      {issue.age}
                    </span>
                  )}
                  {/* Only the escalating issue keeps counting. Every row
                      ticking would be noise; the one row whose substatus says
                      it is getting worse doing so is the substatus, shown. */}
                  <span
                    className={cn(
                      'whitespace-nowrap text-right font-mono text-sm',
                      compact ? 'w-16' : 'w-24',
                    )}
                  >
                    <Ticker
                      value={issue.events}
                      delay={0.25 + index * 0.055}
                      live={issue.substatus === 'Escalating' ? 1.4 : 0}
                    />
                  </span>
                  {compact ? null : (
                    <>
                      <span className="w-20 whitespace-nowrap text-right font-mono text-sm">
                        {issue.users.toLocaleString()}
                      </span>
                      <span className="w-36 whitespace-nowrap text-right text-sm text-muted-foreground">
                        {issue.lastSeen}
                      </span>

                      <span className="grid size-8 shrink-0 place-items-center text-muted-foreground">
                        <MoreVertical className="size-4" />
                      </span>
                    </>
                  )}
                </Enter>
              ))}
            </div>
          </Settle>

          <div className="flex shrink-0 items-center justify-between gap-2 pt-4 text-sm">
            <span className="text-muted-foreground">Showing 1-6 of 37</span>
            <span className="px-2">Page 1 of 7</span>
          </div>
        </div>
      </MockShell>
    </MockStage>
  );
}
