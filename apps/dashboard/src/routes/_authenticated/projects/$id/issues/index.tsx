import type { Issue } from '@rustrak/client';
import {
  Button,
  confirm,
  DataTable,
  DataTableColumnsButton,
  DeleteIcon,
  MuteIcon,
  Page,
  PageHeader,
  QueryBar,
  queryFieldsFromColumns,
  ResolveIcon,
  Tag,
  Text,
  useDataTable,
  useToast,
  variantsFromFields,
} from '@rustrak/ui';
import {
  createFileRoute,
  useLoaderData,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
import { useMemo } from 'react';
import { issueColumns } from '../../../../../components/issues/columns';
import {
  narrows,
  statusField,
  withDefaultStatus,
  withoutDefaultStatus,
} from '../../../../../components/issues/status';
import { rustrak } from '../../../../../lib/rustrak';
import {
  fromTableQuery,
  type TableSearch,
  toTableQuery,
  validateTableSearch,
} from '../../../../../lib/table-search';

const PAGE_SIZE = 25;

export const Route = createFileRoute('/_authenticated/projects/$id/issues/')({
  validateSearch: (search: Record<string, unknown>): TableSearch =>
    validateTableSearch(search),
  loaderDeps: ({ search }) => search,
  /*
   * The four names go straight through. `q` carries the status as `is:`, the
   * severities as `level:` and whatever else was typed as free text, and the
   * server's `ListParams` reads the same string this page wrote.
   */
  loader: ({ deps, params }) =>
    rustrak.issues.list(Number(params.id), {
      q: deps.q,
      sort: deps.sort,
      page: deps.page,
      per: deps.per ?? PAGE_SIZE,
    }),
  component: Issues,
});

function Issues() {
  const result = Route.useLoaderData();
  const { t } = useLoaderData({ from: '/_authenticated/projects/$id' });
  const search = Route.useSearch();
  const { id } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const router = useRouter();
  const toast = useToast();

  const projectId = Number(id);
  const columns = useMemo(() => issueColumns(t), [t]);

  /*
   * The state is a field with no column behind it: it decides which issues
   * come back and draws no cells. Everything else the bar offers is a column,
   * so the two can never disagree about what is filterable or what it is
   * called.
   */
  const fields = useMemo(
    () => [statusField(t), ...queryFieldsFromColumns(columns)],
    [columns, t],
  );
  const variants = useMemo(() => variantsFromFields(fields), [fields]);

  const query = withDefaultStatus(toTableQuery(search, variants, PAGE_SIZE));
  const page = result.success ? result.data : null;
  const narrowed = narrows(query);

  const go = (next: typeof query) =>
    navigate({
      search: fromTableQuery(withoutDefaultStatus(next), variants, PAGE_SIZE),
      replace: true,
    });

  const table = useDataTable({
    data: page?.items ?? [],
    columns,
    rowCount: page?.total_count ?? 0,
    query,
    onQueryChange: (updater) => go(updater(query)),
    getRowId: (issue) => issue.id,
    enableSelection: true,
    rowMenu: (row) => [
      {
        id: 'resolve',
        label: t.t('issueList.resolve'),
        icon: ResolveIcon,
        onSelect: () => setStatus([row.original], 'resolved'),
      },
      {
        id: 'mute',
        label: t.t('issueList.mute'),
        icon: MuteIcon,
        onSelect: () => setStatus([row.original], 'ignored'),
      },
      {
        id: 'delete',
        label: t.t('issueList.delete'),
        icon: DeleteIcon,
        tone: 'danger',
        separated: true,
        onSelect: () => remove([row.original]),
      },
    ],
  });

  const selected = (page?.items ?? []).filter(
    (issue) => table.state.rowSelection[issue.id],
  );

  /** Resolving and muting are the same call with a different word. */
  async function setStatus(issues: Issue[], next: 'resolved' | 'ignored') {
    if (issues.length === 0) return;

    const outcome = await rustrak.issues.bulkUpdate(projectId, {
      ids: issues.map((issue) => issue.id),
      status: next,
    });

    if (!outcome.success) {
      toast.show({ title: t.t('issueList.updateFailed'), tone: 'danger' });
      return;
    }

    toast.show({
      title:
        next === 'resolved'
          ? t.t('issueList.resolved', { count: outcome.data.updated })
          : t.t('issueList.muted', { count: outcome.data.updated }),
      tone: 'success',
    });

    table.resetRowSelection();
    router.invalidate();
  }

  /**
   * Deleting, for one issue or a ticked batch.
   *
   * A single target names itself; a batch has no one name to give, so it says
   * how many. Either way the events go with it, which is what the warning is
   * for: this is the one action on the page that does not come back.
   */
  async function remove(issues: Issue[]) {
    if (issues.length === 0) return;

    const single = issues.length === 1 ? issues[0] : undefined;

    const confirmed = await confirm({
      title: single
        ? t.t('issueList.deleteOne', { title: single.short_id })
        : t.t('issueList.deleteMany', { count: issues.length }),
      description: t.t('issueList.deleteWarning'),
      confirmLabel: t.t('issueList.deleteConfirm'),
      cancelLabel: t.t('issueList.deleteCancel'),
      tone: 'danger',
      escapeHint: t.t('issueList.escapeHint'),
    });

    if (!confirmed) return;

    const outcome = await rustrak.issues.bulkDelete(projectId, {
      ids: issues.map((issue) => issue.id),
    });

    if (!outcome.success) {
      toast.show({ title: t.t('issueList.deleteFailed'), tone: 'danger' });
      return;
    }

    toast.show({
      title: t.t('issueList.deleted', { count: outcome.data.deleted }),
      tone: 'success',
    });

    table.resetRowSelection();
    router.invalidate();
  }

  return (
    <Page scroll={false}>
      <PageHeader
        meta={
          page ? (
            <Text tone="tertiary" variant="body">
              {t.t('issueList.countIssues', { count: page.total_count })}
            </Text>
          ) : null
        }
        title={t.t('issueList.title')}
      />

      {result.success ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <QueryBar
              fields={fields}
              filters={query.filters}
              onChange={(next) =>
                go({
                  ...query,
                  filters: next.filters,
                  search: next.search,
                  pagination: { ...query.pagination, pageIndex: 0 },
                })
              }
              search={query.search}
            />
            <DataTableColumnsButton table={table} />
          </div>

          <DataTable
            bulkActions={
              <>
                <Button
                  icon={ResolveIcon}
                  onClick={() => setStatus(selected, 'resolved')}
                  size="xs"
                  variant="secondary"
                >
                  {t.t('issueList.resolve')}
                </Button>
                <Button
                  icon={MuteIcon}
                  onClick={() => setStatus(selected, 'ignored')}
                  size="xs"
                  variant="secondary"
                >
                  {t.t('issueList.mute')}
                </Button>
                <Button
                  icon={DeleteIcon}
                  onClick={() => remove(selected)}
                  size="xs"
                  variant="danger-primary"
                >
                  {t.t('issueList.delete')}
                </Button>
              </>
            }
            className="min-h-0 flex-1"
            empty={
              narrowed
                ? { title: t.t('issueList.noMatch') }
                : {
                    title: t.t('issueList.emptyTitle'),
                    description: t.t('issueList.emptyDescription'),
                  }
            }
            onRowClick={(row) =>
              navigate({
                to: '/projects/$id/issues/$issue',
                params: { id, issue: row.original.id },
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
