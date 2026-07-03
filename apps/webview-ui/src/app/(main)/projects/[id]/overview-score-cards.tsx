import type { SessionSummary } from '@rustrak/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface OverviewScoreCardsProps {
  summary: SessionSummary;
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

export function OverviewScoreCards({ summary }: OverviewScoreCardsProps) {
  const cards = [
    {
      label: 'Crash-free sessions',
      value: pct(summary.crash_free_sessions_rate),
      className: crashFreeClass(summary.crash_free_sessions_rate),
    },
    {
      label: 'Crash-free users',
      value: pct(summary.crash_free_users_rate),
      className: crashFreeClass(summary.crash_free_users_rate),
    },
    {
      label: 'Total sessions',
      value: summary.total.toLocaleString(),
      className: 'text-foreground',
    },
    {
      label: 'Active releases',
      value: summary.active_releases.toLocaleString(),
      className: 'text-foreground',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.label} size="sm">
          <CardHeader>
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${card.className}`}>
              {card.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
