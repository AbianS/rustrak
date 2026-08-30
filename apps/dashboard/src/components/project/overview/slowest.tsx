import type { TransactionStats } from '@rustrak/client';
import type { Translator } from '@rustrak/i18n';
import {
  Card,
  CardBody,
  CardEmpty,
  CardHeader,
  ScatterChart,
  type ScatterPoint,
} from '@rustrak/ui';
import { useMemo } from 'react';
import { durationAxis, numberFormats } from './format';

interface SlowestProps {
  transactions: readonly TransactionStats[];
  t: Translator;
}

/** One in twenty failing is where latency stops being the story. */
const FAILING = 0.05;
/** Half the requests over a second is slow for everyone, not just the tail. */
const SLOW = 1000;

function toneFor(row: TransactionStats): ScatterPoint['tone'] {
  if (row.failure_rate > FAILING) return 'danger';
  if (row.p95_ms > SLOW) return 'warning';
  return 'neutral';
}

/**
 * Latency against volume, one dot per transaction group.
 *
 * A ranked list of the slowest routes was the obvious thing and it answers the
 * wrong question. It puts a nightly batch job nobody waits on at the top and
 * buries the checkout call underneath it, because ranking by p95 alone treats
 * a route called twice a day and one called twice a second as the same news.
 *
 * Plotted against how often each is called, they separate into corners and the
 * top right is the work: slow *and* busy. p95 rather than the mean, because the
 * mean of a latency distribution is a figure nobody experiences.
 *
 * The endpoint takes no window, so this is all time and the subtitle says so.
 */
export function Slowest({ transactions, t }: SlowestProps) {
  const { compact } = numberFormats(t.locale);
  const slowest = Math.max(...transactions.map((row) => row.p95_ms), 0);
  const formatY = durationAxis(t.locale, slowest);

  const points: ScatterPoint[] = useMemo(
    () =>
      transactions.map((row) => ({
        id: `${row.transaction_name} ${row.op ?? ''}`,
        name: row.op
          ? `${row.transaction_name} · ${row.op}`
          : row.transaction_name,
        x: row.count,
        y: row.p95_ms,
        tone: toneFor(row),
      })),
    [transactions],
  );

  return (
    <Card fill>
      <CardHeader
        subtitle={t.t('projectOverview.slowestSubtitle')}
        title={t.t('projectOverview.slowest')}
      />
      <CardBody>
        {points.length === 0 ? (
          <CardEmpty>{t.t('projectOverview.noTransactions')}</CardEmpty>
        ) : (
          <ScatterChart
            fill
            formatX={(value) => compact.format(value)}
            formatY={formatY}
            height={260}
            label={t.t('projectOverview.slowest')}
            points={points}
            xCaption={t.t('projectOverview.axisCalls')}
            yCaption={t.t('projectOverview.axisP95')}
          />
        )}
      </CardBody>
    </Card>
  );
}
