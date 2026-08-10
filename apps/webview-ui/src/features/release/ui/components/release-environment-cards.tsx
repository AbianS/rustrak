import type { ReleaseHealthRow } from '@rustrak/client';
import { getTranslations } from 'next-intl/server';
import { crashFreeClass, pct } from '@/features/release/model/session-health';
import { cn } from '@/shared/lib/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/ui/components/shadcn/card';

interface ReleaseEnvironmentCardsProps {
  rows: ReleaseHealthRow[];
}

export async function ReleaseEnvironmentCards({
  rows,
}: ReleaseEnvironmentCardsProps) {
  const t = await getTranslations('releases');

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
                <p className="text-[10px] text-muted-foreground">
                  {t('sessions')}
                </p>
                <p className="text-xl font-bold">
                  {row.total.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">
                  {t('crashFreeSessions')}
                </p>
                <p
                  className={cn(
                    'text-xl font-bold',
                    crashFreeClass(row.crash_free_sessions_rate),
                  )}
                >
                  {pct(row.crash_free_sessions_rate)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">
                  {t('crashFreeUsers')}
                </p>
                <p
                  className={cn(
                    'text-xl font-bold',
                    crashFreeClass(row.crash_free_users_rate),
                  )}
                >
                  {pct(row.crash_free_users_rate)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">
                  {t('crashed')}
                </p>
                <p
                  className={cn(
                    'text-xl font-bold',
                    row.crashed > 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-muted-foreground',
                  )}
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
