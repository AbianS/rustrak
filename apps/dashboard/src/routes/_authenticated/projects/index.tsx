import type { Project } from '@rustrak/client';
import {
  createTranslator,
  type MessageKey,
  type Translator,
} from '@rustrak/i18n';
import {
  Button,
  confirm,
  DataTable,
  DataTableColumnsButton,
  DeleteIcon,
  NewIcon,
  Page,
  PageHeader,
  QueryBar,
  queryFieldsFromColumns,
  SegmentedControl,
  SegmentedItem,
  Tag,
  Text,
  useDataTable,
  useToast,
  variantsFromFields,
} from '@rustrak/ui';
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
import { useMemo } from 'react';
import { projectColumns } from '../../../components/projects/columns';
import { localeFor } from '../../../lib/locale';
import { rustrak } from '../../../lib/rustrak';
import {
  fromTableQuery,
  type TableSearch,
  toTableQuery,
  validateTableSearch,
} from '../../../lib/table-search';

const PAGE_SIZE = 20;

/**
 * The windows the activity column can be read over.
 *
 * The server takes anything from an hour to ninety days and buckets the trend
 * across whatever it is given, so these are a choice of framing rather than a
 * limit. `24h` is the default because a list is usually opened to answer
 * "what is on fire now".
 */
export const PERIODS = ['24h', '7d', '30d', '90d'] as const;
export type Period = (typeof PERIODS)[number];

const PERIOD_LABELS: Record<Period, MessageKey> = {
  '24h': 'projectList.p24h',
  '7d': 'projectList.p7d',
  '30d': 'projectList.p30d',
  '90d': 'projectList.p90d',
};

const DEFAULT_PERIOD: Period = '24h';

/** `undefined` for the default, so it stays out of the address bar. */
function validPeriod(value: unknown): Period | undefined {
  if (value === DEFAULT_PERIOD) return undefined;
  return PERIODS.includes(value as Period) ? (value as Period) : undefined;
}

interface ProjectsSearch extends TableSearch {
  period?: Period;
}

export const Route = createFileRoute('/_authenticated/projects/')({
  // The table's four, plus the window the activity column is read over. The
  // window is in the URL for the same reason the rest is: share the address
  // and the other person sees the same list over the same days.
  validateSearch: (search: Record<string, unknown>): ProjectsSearch => {
    const period = validPeriod(search.period);
    const table = validateTableSearch(search);
    return period ? { ...table, period } : table;
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    const [t, page] = await Promise.all([
      createTranslator({
        locale: localeFor(context.session),
        namespaces: ['projectList'],
      }),
      rustrak.projects.list({
        q: deps.q,
        sort: deps.sort,
        page: deps.page,
        per: deps.per ?? PAGE_SIZE,
        stats_period: deps.period ?? DEFAULT_PERIOD,
      }),
    ]);

    return { t, result: page };
  },
  component: Projects,
});

function Projects() {
  const { t, result } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const router = useRouter();
  const toast = useToast();

  const period = search.period ?? DEFAULT_PERIOD;

  const columns = useMemo(
    () => projectColumns(t, t.t(PERIOD_LABELS[period])),
    [t, period],
  );
  const fields = useMemo(() => queryFieldsFromColumns(columns), [columns]);
  const variants = useMemo(() => variantsFromFields(fields), [fields]);

  const query = toTableQuery(search, variants, PAGE_SIZE);
  const page = result.success ? result.data : null;
  const narrowed = query.filters.length > 0 || query.search !== '';

  /*
   * `nextPeriod` has no default on purpose. `24h` is represented as
   * `undefined` so it stays out of the address bar, and a default parameter
   * would swallow it: passing `undefined` explicitly is exactly what triggers
   * a default in JavaScript, so choosing 24 h asked for the period already on
   * screen and nothing moved.
   */
  const go = (next: typeof query, nextPeriod: Period | undefined) =>
    navigate({
      search: {
        ...fromTableQuery(next, variants, PAGE_SIZE),
        period: nextPeriod,
      },
      replace: true,
    });

  const table = useDataTable({
    data: page?.items ?? [],
    columns,
    rowCount: page?.total_count ?? 0,
    query,
    // The URL is the state. A header click proposes a sort, the proposal
    // becomes an address, and the loader answers it.
    onQueryChange: (updater) => go(updater(query), search.period),
    getRowId: (project) => String(project.id),
    enableSelection: true,
    rowMenu: (row) => [
      {
        id: 'delete',
        label: t.t('projectList.delete'),
        icon: DeleteIcon,
        tone: 'danger',
        onSelect: () => remove([row.original]),
      },
    ],
  });

  /**
   * Deleting, for one project or a ticked batch.
   *
   * A single target names itself and asks for its slug to be typed: this is
   * what the design system's `phrase` is for, and the events, issues and
   * releases that go with it do not come back. A batch has no one name to
   * give, so it says how many.
   */
  async function remove(projects: Project[]) {
    if (projects.length === 0) return;

    const single = projects.length === 1 ? projects[0] : undefined;

    const confirmed = await confirm({
      title: single
        ? t.t('projectList.deleteOne', { name: single.name })
        : t.t('projectList.deleteMany', { count: projects.length }),
      description: t.t('projectList.deleteWarning'),
      confirmLabel: t.t('projectList.deleteConfirm'),
      cancelLabel: t.t('projectList.deleteCancel'),
      tone: 'danger',
      phrase: single?.slug,
      // The design system ships English defaults for the phrase box; the
      // product does not get to.
      phraseLabel: t.t('projectList.phraseLabel', { phrase: '{phrase}' }),
      charactersLeftLabel: t.t('projectList.charactersLeft', {
        count: '{count}',
      }),
      escapeHint: t.t('projectList.escapeHint'),
    });

    if (!confirmed) return;

    const results = await Promise.all(
      projects.map((project) => rustrak.projects.delete(project.id)),
    );
    const deleted = results.filter((outcome) => outcome.success).length;

    if (deleted > 0) {
      toast.show({
        title: t.t('projectList.deleted', { count: deleted }),
        tone: 'success',
      });
    }
    if (deleted < projects.length) {
      toast.show({ title: t.t('projectList.deleteFailed'), tone: 'danger' });
    }

    table.resetRowSelection();
    router.invalidate();
  }

  const selected = (page?.items ?? []).filter(
    (project) => table.state.rowSelection[String(project.id)],
  );

  return (
    <Page scroll={false}>
      <PageHeader
        actions={
          <>
            <SegmentedControl
              aria-label={t.t('projectList.period')}
              onValueChange={(value) => go(query, validPeriod(value))}
              value={period}
            >
              {PERIODS.map((option) => (
                <SegmentedItem key={option} value={option}>
                  {t.t(PERIOD_LABELS[option])}
                </SegmentedItem>
              ))}
            </SegmentedControl>
            {/* Disabled until the creation flow lands: the header of a list
                screen is where the reader looks for it, and an empty header
                reads as "you cannot", which is not what is true. */}
            <Button disabled icon={NewIcon} variant="primary">
              {t.t('projectList.newProject')}
            </Button>
          </>
        }
        meta={
          page ? (
            <Summary items={page.items} t={t} total={page.total_count} />
          ) : null
        }
        title={t.t('projectList.title')}
      />

      {result.success ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <QueryBar
              fields={fields}
              filters={query.filters}
              onChange={(next) =>
                go(
                  {
                    ...query,
                    filters: next.filters,
                    search: next.search,
                    pagination: { ...query.pagination, pageIndex: 0 },
                  },
                  search.period,
                )
              }
              search={query.search}
            />
            <DataTableColumnsButton table={table} />
          </div>

          <DataTable
            className="min-h-0 flex-1"
            bulkActions={
              <Button
                icon={DeleteIcon}
                onClick={() => remove(selected)}
                size="xs"
                variant="danger-primary"
              >
                {t.t('projectList.delete')}
              </Button>
            }
            empty={
              narrowed
                ? { title: t.t('projectList.noMatch') }
                : {
                    title: t.t('projectList.emptyTitle'),
                    description: t.t('projectList.emptyDescription'),
                  }
            }
            onRowClick={(row) =>
              navigate({
                to: '/projects/$id',
                params: { id: String(row.original.id) },
              })
            }
            table={table}
          />
        </div>
      ) : (
        <div className="flex max-w-xl items-center gap-3 rounded-md border border-border bg-surface p-4">
          <Tag tone="error" variant="soft">
            {result.error.kind}
          </Tag>
          <Text tone="secondary" variant="body">
            {result.error.message}
          </Text>
        </div>
      )}
    </Page>
  );
}

/** The line under the title: how many, how many are on fire. */
function Summary({
  items,
  t,
  total,
}: {
  items: readonly Project[];
  t: Translator;
  total: number;
}) {
  const burning = items.filter(
    (project) => (project.stats?.fatal_issues ?? 0) > 0,
  ).length;

  return (
    <Text tone="tertiary" variant="body">
      {t.t('projectList.countProjects', { count: total })}
      {burning > 0 ? (
        <>
          {' · '}
          <Text tone="error" variant="body">
            {t.t('projectList.withFatal', { count: burning })}
          </Text>
        </>
      ) : null}
    </Text>
  );
}
