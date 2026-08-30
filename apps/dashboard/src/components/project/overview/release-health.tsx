import type { ReleaseHealthRow } from '@rustrak/client';
import type { Translator } from '@rustrak/i18n';
import {
  ArrowRightIcon,
  BarsChart,
  Button,
  Card,
  CardBody,
  CardEmpty,
  CardHeader,
  type ChartSeries,
} from '@rustrak/ui';
import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { numberFormats } from './format';

interface ReleaseHealthProps {
  rows: readonly ReleaseHealthRow[];
  projectId: number;
  t: Translator;
}

/**
 * The version part of `checkout@2026.8.3`.
 *
 * The package name is the same on every bar -- it is the project, and the
 * project is named at the top of the page -- so printing it five times costs
 * the axis all its width and says nothing.
 */
function version(release: string): string {
  return release.includes('@')
    ? release.slice(release.lastIndexOf('@') + 1)
    : release;
}

/**
 * Environments are summed rather than drawn apart.
 *
 * The endpoint reports one row per release *and* environment, which is five
 * bars in a column this narrow: recharts drops most of the labels and what
 * survives is a chart nobody can read. Which environment a session came from
 * is a question for the releases screen; the question here is which version
 * people are on and whether it holds.
 */
function byRelease(rows: readonly ReleaseHealthRow[]) {
  const totals = new Map<
    string,
    { release: string; healthy: number; errored: number; crashed: number }
  >();

  for (const row of rows) {
    const key = version(row.release);
    const entry = totals.get(key) ?? {
      release: key,
      healthy: 0,
      errored: 0,
      crashed: 0,
    };

    entry.healthy += Math.max(row.total - row.errored - row.crashed, 0);
    entry.errored += row.errored;
    entry.crashed += row.crashed;
    totals.set(key, entry);
  }

  return [...totals.values()].sort(
    (a, b) =>
      b.healthy + b.errored + b.crashed - (a.healthy + a.errored + a.crashed),
  );
}

/**
 * Sessions per release, stacked healthy against crashed.
 *
 * One chart answering the two questions that only mean something together.
 * The height of a bar is adoption, so a release nobody is on is visibly short;
 * the red band is how it is holding up. A release at 91 % crash-free is an
 * incident if it is serving everybody and a footnote if six people are on it,
 * and a table of rates alone cannot tell those apart.
 *
 * Errored sits between the two because it is neither: a session that reported
 * an error and still ended cleanly is not a crash, and folding it into either
 * band would overstate one of them.
 */
export function ReleaseHealth({ rows, projectId, t }: ReleaseHealthProps) {
  const { compact } = numberFormats(t.locale);

  const series: ChartSeries[] = useMemo(
    () => [
      {
        key: 'healthy',
        label: t.t('projectOverview.seriesHealthy'),
        color: 'var(--chart-3)',
      },
      {
        key: 'errored',
        label: t.t('projectOverview.seriesErrored'),
        color: 'var(--sev-warning)',
      },
      {
        key: 'crashed',
        label: t.t('projectOverview.seriesCrashed'),
        color: 'var(--sev-error)',
      },
    ],
    [t],
  );

  const data = useMemo(() => byRelease(rows), [rows]);

  return (
    <Card fill>
      <CardHeader
        actions={
          <Button
            icon={ArrowRightIcon}
            render={
              <Link
                params={{ id: String(projectId) }}
                to="/projects/$id/releases"
              />
            }
            size="xs"
            variant="ghost"
          >
            {t.t('projectOverview.viewAll')}
          </Button>
        }
        subtitle={t.t('projectOverview.releaseHealthSubtitle')}
        title={t.t('projectOverview.releaseHealth')}
      />
      <CardBody>
        {data.length === 0 ? (
          <CardEmpty>{t.t('projectOverview.noReleases')}</CardEmpty>
        ) : (
          <BarsChart
            data={data}
            fill
            formatY={(value) => compact.format(value)}
            height={240}
            label={t.t('projectOverview.releaseHealth')}
            series={series}
            stacked
            xInterval={0}
            xKey="release"
            yAxisWidth={48}
          />
        )}
      </CardBody>
    </Card>
  );
}
