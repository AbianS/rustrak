import type { ReleaseHealth } from '@rustrak/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ReleaseEnvironmentCardsProps {
  rows: ReleaseHealth;
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

export function ReleaseEnvironmentCards({ rows }: ReleaseEnvironmentCardsProps) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <Card key={row.environment} size="sm">
          <CardHeader>
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {row.environment}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground">Sessions</p>
                <p className="text-xl font-bold">{row.total.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">
                  Crash-free sessions
                </p>
                <p
                  className={`text-xl font-bold ${crashFreeClass(row.crash_free_sessions_rate)}`}
                >
                  {pct(row.crash_free_sessions_rate)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">
                  Crash-free users
                </p>
                <p
                  className={`text-xl font-bold ${crashFreeClass(row.crash_free_users_rate)}`}
                >
                  {pct(row.crash_free_users_rate)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Crashed</p>
                <p
                  className={`text-xl font-bold ${row.crashed > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}
                >
                  {row.crashed > 0 ? row.crashed.toLocaleString() : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
