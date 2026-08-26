import type { EventTimeseries } from '@rustrak/client';
import type { Translator } from '@rustrak/i18n';
import {
  BarsChart,
  Card,
  CardBody,
  CardEmpty,
  CardHeader,
  type ChartSeries,
  Tag,
} from '@rustrak/ui';
import { useMemo } from 'react';
import type { Period } from '../../../lib/period';
import { bucketLabel, numberFormats } from './format';

interface ErrorVolumeProps {
  data: EventTimeseries;
  period: Period;
  periodLabel: string;
  t: Translator;
}

/**
 * What came in, bucketed, split by severity.
 *
 * Three series and not four: `fatal` is folded into `error`, because at a
 * hundred buckets a fatal segment is a line one pixel tall that nobody can
 * pick out, and the count that matters is said in words above the chart
 * instead. The server's own `total` already sums the four, so folding here
 * keeps the stack summing to the same height it reports.
 */
export function ErrorVolume({
  data,
  period,
  periodLabel,
  t,
}: ErrorVolumeProps) {
  const { integer, compact } = numberFormats(t.locale);

  const series: ChartSeries[] = useMemo(
    () => [
      {
        key: 'errors',
        label: t.t('charts.errors'),
        color: 'var(--sev-error)',
      },
      {
        key: 'warnings',
        label: t.t('charts.warnings'),
        color: 'var(--sev-warning)',
      },
      { key: 'info', label: t.t('charts.info'), color: 'var(--sev-info)' },
    ],
    [t],
  );

  const rows = useMemo(
    () =>
      data.map((point) => ({
        bucket: point.bucket,
        errors: point.fatal + point.error,
        warnings: point.warning,
        info: point.info,
      })),
    [data],
  );

  const total = data.reduce((sum, point) => sum + point.total, 0);
  const fatal = data.reduce((sum, point) => sum + point.fatal, 0);
  const formatX = bucketLabel(t.locale, period);

  return (
    <Card fill>
      <CardHeader
        actions={
          fatal > 0 ? (
            <Tag tone="error" variant="soft">
              {t.t('projectOverview.fatalCount', {
                count: integer.format(fatal),
              })}
            </Tag>
          ) : null
        }
        subtitle={t.t('projectOverview.errorVolumeSubtitle', {
          count: integer.format(total),
          period: periodLabel,
        })}
        title={t.t('projectOverview.errorVolume')}
      />
      <CardBody>
        {total === 0 ? (
          <CardEmpty>{t.t('projectOverview.noEvents')}</CardEmpty>
        ) : (
          <BarsChart
            data={rows}
            fill
            formatX={formatX}
            formatY={(value) => compact.format(value)}
            height={260}
            label={t.t('projectOverview.errorVolume')}
            series={series}
            stacked
            xKey="bucket"
          />
        )}
      </CardBody>
    </Card>
  );
}
