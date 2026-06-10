import type { ReleaseHealth } from '@rustrak/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ReleaseHealthCardProps {
  health: ReleaseHealth;
}

function pct(rate: number | null): string {
  if (rate === null) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

export function ReleaseHealthCard({ health }: ReleaseHealthCardProps) {
  if (health.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Release Health</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="text-left pb-2 pr-4">Release</th>
                <th className="text-left pb-2 pr-4">Env</th>
                <th className="text-right pb-2 pr-4">Sessions</th>
                <th className="text-right pb-2 pr-4">Crash-free</th>
                <th className="text-right pb-2 pr-4">Users</th>
                <th className="text-right pb-2">Crashed</th>
              </tr>
            </thead>
            <tbody>
              {health.map((row) => (
                <tr
                  key={`${row.release}-${row.environment}`}
                  className="border-b last:border-0"
                >
                  <td className="py-2 pr-4 font-mono text-xs truncate max-w-32">
                    {row.release}
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground text-xs">
                    {row.environment}
                  </td>
                  <td className="py-2 pr-4 text-right">{row.total}</td>
                  <td className="py-2 pr-4 text-right">
                    <span
                      className={
                        row.crash_free_sessions_rate !== null &&
                        row.crash_free_sessions_rate >= 0.99
                          ? 'text-green-600 dark:text-green-400'
                          : row.crash_free_sessions_rate !== null &&
                              row.crash_free_sessions_rate >= 0.95
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-red-600 dark:text-red-400'
                      }
                    >
                      {pct(row.crash_free_sessions_rate)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {pct(row.crash_free_users_rate)}
                  </td>
                  <td className="py-2 text-right text-red-600 dark:text-red-400">
                    {row.crashed > 0 ? row.crashed : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
