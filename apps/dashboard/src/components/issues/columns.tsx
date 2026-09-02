import type { Issue } from '@rustrak/client';
import type { Translator } from '@rustrak/i18n';
import {
  createDataTableColumnHelper,
  Sparkline,
  type SparklineTone,
  Tag,
  type TagTone,
  Text,
} from '@rustrak/ui';
import { relativeTime } from '../project/overview/format';

const columnHelper = createDataTableColumnHelper<Issue>();

/**
 * The SDK's own vocabulary, not ours, so the word is not translated: it is what
 * the event payload says and what `level:` in the query bar has to be typed as.
 */
const LEVELS = ['fatal', 'error', 'warning', 'info'] as const;

const LEVEL_TONE: Record<string, { tag: TagTone; spark: SparklineTone }> = {
  fatal: { tag: 'error', spark: 'danger' },
  error: { tag: 'error', spark: 'danger' },
  warning: { tag: 'warning', spark: 'warning' },
};

function toneFor(level: string | null) {
  return (
    LEVEL_TONE[level ?? ''] ?? {
      tag: 'info' as const,
      spark: 'neutral' as const,
    }
  );
}

/**
 * The issue table, built per locale.
 *
 * A function rather than a constant because every header, label and sort option
 * is copy, and copy comes from the catalog. Memoise the result against the
 * translator at the call site.
 *
 * The column ids are the server's `?sort=` names and the query bar's `key:`
 * names at once. That is the whole point of the list contract: `IssueSort` in
 * `services/issue.rs` reads the same words this file writes, so a header click
 * and a typed filter reach the same `ORDER BY` and the same `WHERE`.
 */
export function issueColumns(t: Translator) {
  const integer = new Intl.NumberFormat(t.locale, { maximumFractionDigits: 0 });
  const compact = new Intl.NumberFormat(t.locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  return columnHelper.columns([
    columnHelper.accessor((issue) => issue.level ?? 'error', {
      id: 'level',
      header: t.t('issueList.colLevel'),
      cell: ({ row }) => (
        <Tag tone={toneFor(row.original.level).tag}>
          {row.original.level ?? 'error'}
        </Tag>
      ),
      meta: {
        label: t.t('issueList.colLevel'),
        width: 84,
        sortLabels: {
          asc: t.t('issueList.levelAsc'),
          desc: t.t('issueList.levelDesc'),
        },
        filter: {
          variant: 'options',
          multiple: true,
          options: LEVELS.map((level) => ({ value: level, label: level })),
        },
      },
    }),

    columnHelper.accessor('title', {
      id: 'issue',
      header: t.t('issueList.colIssue'),
      enableHiding: false,
      cell: ({ row }) => (
        <span className="flex min-w-0 flex-col gap-0.5 py-2">
          <Text truncate variant="value">
            {row.original.title}
          </Text>
          <Text tone="ghost" truncate variant="mono-sm">
            {row.original.short_id}
            {row.original.culprit ? ` · ${row.original.culprit}` : ''}
            {row.original.last_release ? ` · ${row.original.last_release}` : ''}
          </Text>
        </span>
      ),
      meta: {
        label: t.t('issueList.colIssue'),
        sortLabels: {
          asc: t.t('issueList.aToZ'),
          desc: t.t('issueList.zToA'),
        },
        filter: {
          variant: 'text',
          placeholder: t.t('issueList.issueContains'),
        },
      },
    }),

    columnHelper.accessor((issue) => issue.trend ?? [], {
      id: 'trend',
      header: t.t('issueList.colTrend'),
      // Neither sortable nor filterable: the trend is an aggregate the server
      // computes for the page it already fetched, so narrowing by it would
      // mean pulling the whole table through the stats query.
      enableSorting: false,
      cell: ({ row }) => {
        const trend = row.original.trend;
        if (!trend?.length) return null;

        return (
          <Sparkline
            label={t.t('issueList.trendLabel', { title: row.original.title })}
            tone={toneFor(row.original.level).spark}
            values={trend}
          />
        );
      },
      meta: { label: t.t('issueList.colTrend'), width: 130 },
    }),

    columnHelper.accessor('event_count', {
      id: 'events',
      header: t.t('issueList.colEvents'),
      cell: ({ getValue }) => (
        <Text variant="mono">{compact.format(getValue())}</Text>
      ),
      meta: {
        label: t.t('issueList.colEvents'),
        width: 96,
        align: 'end',
        numeric: true,
        sortLabels: {
          asc: t.t('issueList.fewestEvents'),
          desc: t.t('issueList.mostEvents'),
        },
        filter: { variant: 'range', min: 0, unit: t.t('issueList.events') },
      },
    }),

    columnHelper.accessor((issue) => issue.user_count ?? 0, {
      id: 'users',
      header: t.t('issueList.colUsers'),
      // `user_count` comes from `list_stats`, computed per page. `IssueSort`
      // omits it for the same reason, and the two have to agree: a header that
      // offers a sort the server drops looks broken.
      enableSorting: false,
      cell: ({ getValue }) => (
        <Text tone="tertiary" variant="mono">
          {integer.format(getValue())}
        </Text>
      ),
      // No filter either: the server cannot narrow by a figure it computes
      // after the page is chosen. A bar offering `users:` would return a page
      // filtered against the wrong set.
      meta: {
        label: t.t('issueList.colUsers'),
        width: 88,
        align: 'end',
        numeric: true,
      },
    }),

    columnHelper.accessor('last_seen', {
      id: 'seen',
      header: t.t('issueList.colSeen'),
      cell: ({ getValue }) => (
        <Text tone="tertiary" variant="meta">
          {relativeTime(t.locale, getValue())}
        </Text>
      ),
      meta: {
        label: t.t('issueList.colSeen'),
        width: 108,
        align: 'end',
        sortLabels: {
          asc: t.t('issueList.oldestFirst'),
          desc: t.t('issueList.newestFirst'),
        },
        // A window, and exactly one holds at a time. The value is days, which
        // is what the server reads.
        filter: {
          variant: 'options',
          multiple: false,
          options: [
            { value: '1', label: t.t('issueList.last24h') },
            { value: '7', label: t.t('issueList.last7d') },
            { value: '30', label: t.t('issueList.last30d') },
            { value: '90', label: t.t('issueList.last90d') },
          ],
        },
      },
    }),
  ]);
}
