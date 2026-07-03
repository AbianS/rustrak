'use client';

import type { ReleaseHealth } from '@rustrak/client';
import { Rocket } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useRef, useState, useTransition } from 'react';
import { getReleaseHealth } from '@/actions/sessions';
import { Card, CardContent } from '@/components/ui/card';
import { crashFreeClass, pct } from '@/lib/session-health';
import { cn } from '@/lib/utils';

interface ReleasesListProps {
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

export function ReleasesList({ projectId, initialHealth }: ReleasesListProps) {
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
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.label}
            onClick={() => handlePeriodChange(p.value)}
            disabled={isPending}
            className={cn(
              'px-2.5 py-1 text-xs rounded-md font-medium transition-colors',
              period === p.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {health.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Rocket className="size-12 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold mb-1">No releases yet</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Send a <code>release</code> attribute with your events or sessions
            to start tracking release health.
          </p>
        </div>
      ) : (
        <div
          className={cn(
            'flex flex-col gap-2 transition-opacity',
            isPending && 'opacity-50 pointer-events-none',
          )}
        >
          {health.map((row) => (
            <Link
              key={`${row.release}-${row.environment}`}
              href={`/projects/${projectId}/releases/${encodeURIComponent(row.release)}?environment=${encodeURIComponent(row.environment)}`}
            >
              <Card
                size="sm"
                className="hover:ring-primary/40 transition-shadow cursor-pointer"
              >
                <CardContent>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="font-mono text-sm truncate text-foreground">
                      {row.release}
                    </p>
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">
                      {row.environment}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        Sessions
                      </p>
                      <p className="text-sm font-semibold">{row.total}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        Crash-free sessions
                      </p>
                      <p
                        className={cn(
                          'text-sm font-semibold',
                          crashFreeClass(row.crash_free_sessions_rate),
                        )}
                      >
                        {pct(row.crash_free_sessions_rate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        Crash-free users
                      </p>
                      <p
                        className={cn(
                          'text-sm font-semibold',
                          crashFreeClass(row.crash_free_users_rate),
                        )}
                      >
                        {pct(row.crash_free_users_rate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        Crashed
                      </p>
                      <p
                        className={cn(
                          'text-sm font-semibold',
                          row.crashed > 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-muted-foreground',
                        )}
                      >
                        {row.crashed > 0 ? row.crashed : '—'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
