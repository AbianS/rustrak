import type { SessionSummary, SessionTimeseries } from '@rustrak/client';
import type { Translator } from '@rustrak/i18n';
import {
  Card,
  CardBody,
  CardEmpty,
  CardHeader,
  type ChartSeries,
  Text,
  TimeSeriesChart,
} from '@rustrak/ui';
import { useMemo } from 'react';
import type { Period } from '../../../lib/period';
import { bucketLabel, numberFormats } from './format';

interface CrashFreeProps {
  summary: SessionSummary | null;
  trend: SessionTimeseries;
  period: Period;
  t: Translator;
}

/**
 * The rate, and the shape it made getting there.
 *
 * The headline figure and the line beneath it are the pair the design asks
 * for, and the pairing is the point: a rate on its own says 99.4 % as loudly
 * for an hour with two sessions in it as for an hour with two hundred
 * thousand. The count under the figure says how much to believe it, and the
 * line says whether it has been that way all window or fell off a cliff an
 * hour ago.
 *
 * The Y scale is the lowest reading it holds, rounded down, up to a hundred
 * per cent. Neither of the obvious choices works: nought to a hundred draws a
 * solid block with the whole story inside the top pixel, and letting recharts
 * pick puts the baseline wherever the worst bucket happens to fall, so a good
 * window and a bad one are drawn the same shape.
 */
export function CrashFree({ summary, trend, period, t }: CrashFreeProps) {
  const { integer, rate } = numberFormats(t.locale);

  const series: ChartSeries[] = useMemo(
    () => [
      {
        key: 'rate',
        label: t.t('projectOverview.crashFreeSeries'),
        color: 'var(--chart-3)',
      },
    ],
    [t],
  );

  /* A bucket with no sessions has no rate, and recharts draws a gap for null.
     Filling it with zero would draw an outage that never happened. */
  const rows = useMemo(
    () =>
      trend.map((point) => ({
        bucket: point.bucket,
        rate: point.crash_free_sessions_rate,
      })),
    [trend],
  );

  const measured = summary && summary.total > 0;

  const floor = rows.reduce(
    (lowest, row) => (row.rate === null ? lowest : Math.min(lowest, row.rate)),
    1,
  );
  // A tenth of a point of headroom, so the worst bucket is not welded to the
  // axis, and never a floor above 99.5 %: past that the line is noise.
  const domain: [number, number] = [Math.min(floor - 0.001, 0.995), 1];

  return (
    <Card fill>
      <CardHeader
        subtitle={t.t('projectOverview.crashFreeSubtitle')}
        title={t.t('projectOverview.metricCrashFree')}
      />
      <CardBody>
        {measured ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Text variant="numeric-lg">
                {summary.crash_free_sessions_rate === null
                  ? '—'
                  : rate.format(summary.crash_free_sessions_rate)}
              </Text>
              <Text tone="ghost" variant="hint">
                {t.t('projectOverview.sessionsCounted', {
                  count: integer.format(summary.total),
                })}
              </Text>
            </div>

            <TimeSeriesChart
              className="mt-3"
              fill
              data={rows}
              formatX={bucketLabel(t.locale, period)}
              formatY={(value) => rate.format(value)}
              height={140}
              label={t.t('projectOverview.metricCrashFree')}
              series={series}
              xKey="bucket"
              yAxisWidth={56}
              yDomain={domain}
            />
          </>
        ) : (
          <CardEmpty>{t.t('projectOverview.noSessions')}</CardEmpty>
        )}
      </CardBody>
    </Card>
  );
}
