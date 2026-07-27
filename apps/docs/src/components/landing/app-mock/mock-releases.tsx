'use client';

import { Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompact } from './design';
import { RELEASES } from './fixtures';
import {
  MockBadge,
  MockPageHead,
  MockShell,
  MockTh,
  usePad,
} from './mock-shell';
import { Enter, MockStage, Settle, Ticker } from './stage';

/**
 * The releases table, recreated from
 * `projects/[id]/releases/releases-list.tsx`.
 *
 * Two things carry this screen and both are easy to lose:
 *
 * The crash-free figures are coloured on **tiers, not a gradient**:
 * `crashFreeClass` in the real app puts 99% and up in green, 95% and up in
 * amber, and everything below in red. Tiers are what make a column of
 * near-identical percentages scannable — 99.47 and 94.18 are four points apart
 * and look almost the same set in type, so the colour is doing the reading.
 *
 * And the table is deliberately **not all healthy**. A recreated screen where
 * every row is green is showing a product that has never been used; the 2.13.0
 * regression is what gives the tiers something to demonstrate and the row above
 * it something to be compared against.
 */

/** `crashFreeClass` from lib/session-health.ts, on the app's own tiers. */
function rateTone(rate: number): string {
  if (rate >= 0.99) return 'text-emerald-400';
  if (rate >= 0.95) return 'text-amber-400';
  return 'text-red-400';
}

/** `pct` from the same module. */
function pct(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

export function MockReleases() {
  const compact = useCompact();
  const pad = usePad();

  return (
    <MockStage>
      <MockShell active="Releases">
        <div className={pad}>
          <MockPageHead
            title="Releases"
            subtitle="Session health per version, last 14 days"
          />

          <div className="mt-5 overflow-hidden rounded-lg border border-border">
            <div className="flex items-center gap-4 whitespace-nowrap border-b border-border bg-muted/50 px-4 py-3">
              <MockTh className="flex-1">Release</MockTh>
              <MockTh className="w-20 text-right">Sessions</MockTh>
              {compact ? null : (
                <>
                  <MockTh className="w-24 text-right">New issues</MockTh>
                  <MockTh className="w-28 text-right">Crash-free</MockTh>
                  <MockTh className="w-32 text-right">Crash-free users</MockTh>
                </>
              )}
              <MockTh className="w-20 text-right">Crashed</MockTh>
            </div>

            <div className="divide-y divide-border">
              {RELEASES.map((release, index) => (
                <Enter key={release.version} delay={0.12 + index * 0.07}>
                  <div className="flex items-center gap-4 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <Rocket className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate font-mono text-foreground">
                          {release.version}
                        </span>
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <MockBadge>{release.environment}</MockBadge>
                        <span className="text-xs text-muted-foreground">
                          {release.age}
                        </span>
                      </span>
                    </div>

                    <span className="w-20 text-right font-mono tabular-nums text-muted-foreground">
                      <Ticker
                        value={release.sessions}
                        delay={0.3 + index * 0.07}
                      />
                    </span>

                    {compact ? null : (
                      <>
                        {/* The one number the real list endpoint does not
                            return, and the one a reader most wants: which
                            deploy brought new problems with it. */}
                        <span
                          className={cn(
                            'w-24 text-right font-mono tabular-nums',
                            release.newIssues > 0
                              ? 'text-foreground'
                              : 'text-muted-foreground',
                          )}
                        >
                          {release.newIssues > 0
                            ? `+${release.newIssues}`
                            : '—'}
                        </span>
                        <span
                          className={cn(
                            'w-28 text-right font-mono tabular-nums',
                            rateTone(release.crashFreeSessions),
                          )}
                        >
                          {pct(release.crashFreeSessions)}
                        </span>
                        <span
                          className={cn(
                            'w-32 text-right font-mono tabular-nums',
                            rateTone(release.crashFreeUsers),
                          )}
                        >
                          {pct(release.crashFreeUsers)}
                        </span>
                      </>
                    )}

                    <span
                      className={cn(
                        'w-20 text-right font-mono tabular-nums',
                        release.crashed > 500
                          ? 'text-red-400'
                          : 'text-muted-foreground',
                      )}
                    >
                      {release.crashed.toLocaleString()}
                    </span>
                  </div>
                </Enter>
              ))}
            </div>
          </div>

          {/* The real list is offset-paginated like every other table here. */}
          <Settle delay={0.7}>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>Showing 1-5 of 28</span>
              <span className="flex items-center gap-2">
                <span className="rounded-md border border-border px-2 py-1">
                  Previous
                </span>
                <span className="rounded-md border border-border px-2 py-1 text-foreground">
                  Next
                </span>
              </span>
            </div>
          </Settle>
        </div>
      </MockShell>
    </MockStage>
  );
}
