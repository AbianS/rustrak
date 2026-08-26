import type { Project } from '@rustrak/client';
import type { Translator } from '@rustrak/i18n';
import { createDataTableColumnHelper, Sparkline, Text } from '@rustrak/ui';
import { HEALTH_TONE, projectHealth } from './health';
import { PlatformMark } from './platform-mark';

const columnHelper = createDataTableColumnHelper<Project>();

function formatDelta(current: number, previous: number | null): string | null {
  if (previous === null || previous === 0) return null;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return null;
  return `${change > 0 ? '+' : ''}${change}%`;
}

/**
 * The columns, built per locale.
 *
 * A function rather than a constant because every header, label and sort
 * option is copy, and copy comes from the catalog. Memoise the result against
 * the translator at the call site.
 */
export function projectColumns(t: Translator, periodLabel: string) {
  const integer = new Intl.NumberFormat(t.locale, { maximumFractionDigits: 0 });
  const compact = new Intl.NumberFormat(t.locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  return columnHelper.columns([
    columnHelper.accessor('name', {
      id: 'name',
      header: t.t('projectList.colProject'),
      enableHiding: false,
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-3 py-2">
          <PlatformMark platform={row.original.platform} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <Text truncate variant="value">
              {row.original.name}
            </Text>
            <Text tone="ghost" truncate variant="mono-sm">
              {row.original.slug}
            </Text>
          </span>
        </span>
      ),
      meta: {
        label: t.t('projectList.colProject'),
        sortLabels: {
          asc: t.t('projectList.aToZ'),
          desc: t.t('projectList.zToA'),
        },
        filter: {
          variant: 'text',
          placeholder: t.t('projectList.nameContains'),
        },
      },
    }),

    columnHelper.accessor((project) => project.stats?.open_issues ?? 0, {
      id: 'open',
      header: t.t('projectList.colIssues'),
      // Neither sortable nor filterable: `open_issues` is an aggregate
      // computed for the page that was already fetched, so narrowing by it
      // would mean pulling the whole table through the stats query.
      // `ProjectSort` says the same on the server side.
      enableSorting: false,
      cell: ({ row }) => {
        const stats = row.original.stats;
        if (!stats) return null;

        return (
          <span className="flex flex-col items-end gap-0.5">
            <Text variant="mono">{integer.format(stats.open_issues)}</Text>
            {stats.fatal_issues > 0 ? (
              <Text tone="error" variant="mono-sm">
                {t.t('projectList.fatalCount', { count: stats.fatal_issues })}
              </Text>
            ) : null}
          </span>
        );
      },
      meta: {
        label: t.t('projectList.colIssues'),
        width: 96,
        align: 'end',
        numeric: true,
      },
    }),

    columnHelper.accessor((project) => project.stats?.events.current ?? 0, {
      id: 'events',
      header: `${t.t('projectList.colEvents')} ${periodLabel}`,
      enableSorting: false,
      cell: ({ row }) => {
        const stats = row.original.stats;
        if (!stats) return null;

        const delta = formatDelta(stats.events.current, stats.events.previous);

        return (
          <span className="flex flex-col items-end gap-0.5">
            <Text variant="mono">{integer.format(stats.events.current)}</Text>
            {delta ? (
              <Text
                tone={delta.startsWith('+') ? 'warning' : 'tertiary'}
                variant="mono-sm"
              >
                {delta}
              </Text>
            ) : null}
          </span>
        );
      },
      meta: {
        label: `${t.t('projectList.colEvents')} ${periodLabel}`,
        width: 130,
        align: 'end',
        numeric: true,
      },
    }),

    columnHelper.accessor('stored_event_count', {
      id: 'total',
      header: t.t('projectList.colTotal'),
      cell: ({ getValue }) => (
        <Text tone="tertiary" variant="mono-sm">
          {compact.format(getValue())}
        </Text>
      ),
      meta: {
        label: t.t('projectList.colTotal'),
        width: 88,
        align: 'end',
        numeric: true,
        sortLabels: {
          asc: t.t('projectList.fewestEvents'),
          desc: t.t('projectList.mostEvents'),
        },
        filter: { variant: 'range', min: 0, unit: t.t('projectList.events') },
      },
    }),

    columnHelper.accessor((project) => project.stats?.trend ?? [], {
      id: 'trend',
      // The window is a page-level choice, so the header says which one is on
      // screen rather than claiming a fixed number of days.
      header: `${t.t('projectList.colActivity')} ${periodLabel}`,
      enableSorting: false,
      cell: ({ row }) => {
        const stats = row.original.stats;
        if (!stats?.trend.length) return null;

        // Tinted by health rather than by volume: one chatty issue can
        // multiply events without anything new being broken.
        const health = projectHealth(stats);

        return (
          <Sparkline
            label={t.t(
              `projectList.health${health[0].toUpperCase()}${health.slice(1)}` as 'projectList.healthQuiet',
              {
                name: row.original.name,
              },
            )}
            tone={HEALTH_TONE[health]}
            values={stats.trend}
          />
        );
      },
      meta: {
        label: `${t.t('projectList.colActivity')} ${periodLabel}`,
        width: 150,
      },
    }),

    columnHelper.accessor('created_at', {
      id: 'created',
      header: t.t('projectList.colCreated'),
      cell: ({ getValue }) => (
        <Text tone="tertiary" variant="meta">
          {new Date(getValue()).toLocaleDateString(t.locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </Text>
      ),
      meta: {
        label: t.t('projectList.colCreated'),
        width: 110,
        align: 'end',
        sortLabels: {
          asc: t.t('projectList.oldestFirst'),
          desc: t.t('projectList.newestFirst'),
        },
        // A date narrows to a window, and exactly one holds at a time. The
        // value is days, which is what the server reads.
        filter: {
          variant: 'options',
          multiple: false,
          options: [
            { value: '1', label: t.t('projectList.last24h') },
            { value: '7', label: t.t('projectList.last7d') },
            { value: '30', label: t.t('projectList.last30d') },
            { value: '90', label: t.t('projectList.last90d') },
          ],
        },
      },
    }),
  ]);
}
