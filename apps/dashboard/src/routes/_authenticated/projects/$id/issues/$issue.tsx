import {
  Breadcrumbs,
  EmptyIcon,
  Page,
  PageHeader,
  Tag,
  Text,
} from '@rustrak/ui';
import { createFileRoute, Link, useLoaderData } from '@tanstack/react-router';
import { rustrak } from '../../../../../lib/rustrak';

/**
 * One issue. The screen itself is not rebuilt yet, so what it does is name the
 * issue you asked for and say so.
 *
 * It still fetches, and that is the point: it is the address `webview-ui`
 * already uses, so a link from either dashboard lands here, and a row on the
 * overview that navigates nowhere provable is a row nobody trusts.
 */
export const Route = createFileRoute(
  '/_authenticated/projects/$id/issues/$issue',
)({
  loader: ({ params }) => rustrak.issues.get(Number(params.id), params.issue),
  component: IssueDetail,
});

function IssueDetail() {
  const result = Route.useLoaderData();
  const { t } = useLoaderData({ from: '/_authenticated/projects/$id' });
  const { id } = Route.useParams();

  if (!result.success) {
    return (
      <Page>
        <div className="flex max-w-xl items-center gap-3 rounded-md border border-border bg-surface p-4">
          <Tag tone="error" variant="soft">
            {result.error.kind}
          </Tag>
          <Text tone="secondary" variant="body">
            {result.error.message}
          </Text>
        </div>
      </Page>
    );
  }

  const issue = result.data;

  return (
    <Page>
      <Breadcrumbs
        items={[
          {
            label: t.t('projectOverview.navIssues'),
            render: <Link params={{ id }} to="/projects/$id/issues" />,
          },
          { label: issue.short_id },
        ]}
      />

      <PageHeader
        meta={
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <Tag tone={issue.level === 'warning' ? 'warning' : 'error'}>
              {issue.level ?? 'error'}
            </Tag>
            <Text tone="ghost" truncate variant="mono-sm">
              {issue.short_id}
              {issue.culprit ? ` · ${issue.culprit}` : ''}
            </Text>
          </div>
        }
        title={issue.title}
      />

      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <EmptyIcon aria-hidden="true" className="text-fg-ghost" size="xl" />
        <Text tone="secondary" variant="section">
          {t.t('projectOverview.pendingTitle')}
        </Text>
        <Text className="max-w-md" tone="muted" variant="body">
          {t.t('projectOverview.pendingDescription')}
        </Text>
      </div>
    </Page>
  );
}
