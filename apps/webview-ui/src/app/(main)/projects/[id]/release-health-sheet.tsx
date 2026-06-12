'use client';

import type { ReleaseHealth } from '@rustrak/client';
import { Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface ReleaseHealthSheetProps {
  health: ReleaseHealth;
}

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

export function ReleaseHealthSheet({ health }: ReleaseHealthSheetProps) {
  if (health.length === 0) return null;

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

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
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
                  <p className="text-[10px] text-muted-foreground">Sessions</p>
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
      </SheetContent>
    </Sheet>
  );
}
