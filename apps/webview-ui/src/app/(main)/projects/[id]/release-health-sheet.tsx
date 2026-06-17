'use client';

import type { ReleaseHealth } from '@rustrak/client';
import { Activity } from 'lucide-react';
import { useCallback, useRef, useState, useTransition } from 'react';
import { getReleaseHealth } from '@/actions/sessions';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface ReleaseHealthSheetProps {
  projectId: number;
  initialHealth: ReleaseHealth;
}

const PERIODS = [
  { label: 'All', value: undefined as string | undefined },
  { label: '24h', value: '24h' as const },
  { label: '7d', value: '7d' as const },
  { label: '14d', value: '14d' as const },
  { label: '30d', value: '30d' as const },
] as const;

function pct(rate: number | null): string {
  if (rate === null) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

function crashFreeClass(rate: number | null): string {
  if (rate === null) return 'text-muted-foreground';
  if (rate >= 0.99) return 'text-green-600 dark:text-green-400';
  if (rate >= 0.95) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

export function ReleaseHealthSheet({
  projectId,
  initialHealth,
}: ReleaseHealthSheetProps) {
  const [health, setHealth] = useState(initialHealth);
  const [period, setPeriod] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  const latestPeriod = useRef<string | undefined>(undefined);

  const handlePeriodChange = useCallback(
    (newPeriod: string | undefined) => {
      latestPeriod.current = newPeriod;
      setPeriod(newPeriod);
      startTransition(async () => {
        const data = await getReleaseHealth(projectId, newPeriod);
        if (latestPeriod.current === newPeriod) {
          setHealth(data);
        }
      });
    },
    [projectId],
  );

  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="outline" size="icon" title="Release Health" />}
      >
        <Activity className="size-4" />
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex flex-col gap-0 overflow-hidden"
      >
        <SheetHeader className="shrink-0">
          <SheetTitle>Release Health</SheetTitle>
        </SheetHeader>

        <div className="flex gap-1 px-4 py-2 border-b shrink-0">
          {PERIODS.map((p) => (
            <button
              key={p.label}
              onClick={() => handlePeriodChange(p.value)}
              disabled={isPending}
              className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
                period === p.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {health.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {isPending
                ? 'Loading...'
                : 'No release health data for this period'}
            </p>
          </div>
        ) : (
          <div
            className={`flex-1 overflow-y-auto px-4 pb-4 space-y-2 pt-3 transition-opacity ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Releases
            </p>
            {health.map((row) => (
              <div
                key={`${row.release}-${row.environment}`}
                className="rounded-lg border bg-card p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-xs truncate text-foreground">
                    {row.release}
                  </p>
                  <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">
                    {row.environment}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      Sessions
                    </p>
                    <p className="text-sm font-semibold">{row.total}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      Crash-free
                    </p>
                    <p
                      className={`text-sm font-semibold ${crashFreeClass(row.crash_free_sessions_rate)}`}
                    >
                      {pct(row.crash_free_sessions_rate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Users</p>
                    <p className="text-sm font-semibold">
                      {pct(row.crash_free_users_rate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Crashed</p>
                    <p
                      className={`text-sm font-semibold ${row.crashed > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}
                    >
                      {row.crashed > 0 ? row.crashed : '—'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
