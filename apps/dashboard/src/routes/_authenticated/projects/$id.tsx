import { createTranslator } from '@rustrak/i18n';
import { Breadcrumbs, Page, PageHeader, Tag, Text } from '@rustrak/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { localeFor } from '../../../lib/locale';
import { rustrak } from '../../../lib/rustrak';

// The address a row opens, and the one `webview-ui` already uses, so a link
// pasted from either dashboard lands in the same place.
export const Route = createFileRoute('/_authenticated/projects/$id')({
  loader: async ({ context, params }) => {
    const [t, result] = await Promise.all([
      createTranslator({
        locale: localeFor(context.session),
        namespaces: ['projectList'],
      }),
      rustrak.projects.get(Number(params.id)),
    ]);

    return { t, result };
  },
  component: ProjectDetail,
});

function ProjectDetail() {
  const { t, result } = Route.useLoaderData();

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

  const project = result.data;

  return (
    <Page>
      <Breadcrumbs
        items={[
          { label: t.t('projectList.title'), render: <Link to="/projects" /> },
          { label: project.name },
        ]}
      />

      <PageHeader
        meta={
          <Text tone="ghost" variant="mono-sm">
            {project.slug}
          </Text>
        }
        title={project.name}
      />

      <Text tone="muted" variant="body">
        {t.t('projectList.detailSoon')}
      </Text>
    </Page>
  );
}
