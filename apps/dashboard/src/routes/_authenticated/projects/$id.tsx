import { createTranslator } from '@rustrak/i18n';
import {
  Breadcrumbs,
  Page,
  SidebarDrawerButton,
  SubHeader,
  Tag,
  Text,
  Workspace,
} from '@rustrak/ui';
import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { ProjectSidebar } from '../../../components/project/project-sidebar';
import { localeFor } from '../../../lib/locale';
import { rustrak } from '../../../lib/rustrak';

/**
 * Everything scoped to one project: the sidebar, the trail, and whichever of
 * the seven screens is open.
 *
 * The address is the one `webview-ui` already uses, so a link pasted from
 * either dashboard lands in the same place.
 *
 * The sidebar is mounted here rather than on the shell because this is the
 * first route that knows which project it is for. `Workspace` is the design
 * system's row for exactly that: it reads the sidebar state the shell already
 * provides, so collapsing, the drawer and Cmd-B all still work from one place.
 */
export const Route = createFileRoute('/_authenticated/projects/$id')({
  loader: async ({ context, params }) => {
    const [t, project, projects] = await Promise.all([
      createTranslator({
        locale: localeFor(context.session),
        namespaces: ['projectOverview', 'periods', 'charts'],
      }),
      rustrak.projects.get(Number(params.id)),
      // The switcher's list. A page is plenty: past that the answer is
      // `/projects`, which the switcher's last row goes to.
      rustrak.projects.list({ per: 100, sort: 'name' }),
    ]);

    return { t, project, projects };
  },
  component: ProjectLayout,
});

function ProjectLayout() {
  const { t, project, projects } = Route.useLoaderData();

  if (!project.success) {
    return (
      <Page>
        <Failure kind={project.error.kind} message={project.error.message} />
      </Page>
    );
  }

  return (
    <Workspace
      sidebar={
        <ProjectSidebar
          current={project.data}
          projects={projects.success ? projects.data.items : [project.data]}
          t={t}
        />
      }
    >
      <SubHeader>
        <div className="flex min-w-0 items-center gap-2">
          {/* Only below `md`, where the sidebar has left the screen. It sits
              here rather than in the topbar because the sidebar it opens is
              this layout's, and a button in the frame would be drawn on the
              screens that have nothing to open. */}
          <SidebarDrawerButton />
          <Breadcrumbs
            items={[
              {
                label: t.t('projectOverview.breadcrumbProjects'),
                render: <Link to="/projects" />,
              },
              { label: project.data.name },
            ]}
          />
        </div>
      </SubHeader>

      <Outlet />
    </Workspace>
  );
}

/** Said in place of the whole project, because without it there is no screen. */
function Failure({ kind, message }: { kind: string; message: string }) {
  return (
    <div className="flex max-w-xl items-center gap-3 rounded-md border border-border bg-surface p-4">
      <Tag tone="error" variant="soft">
        {kind}
      </Tag>
      <Text tone="secondary" variant="body">
        {message}
      </Text>
    </div>
  );
}
