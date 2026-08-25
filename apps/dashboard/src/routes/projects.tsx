import { Page, PageHeader, Tag, Text } from '@rustrak/ui';
import { createFileRoute } from '@tanstack/react-router';
import { rustrak } from '../lib/rustrak';

export const Route = createFileRoute('/projects')({
  loader: () => rustrak.projects.list({ per_page: 20 }),
  component: Projects,
});

/**
 * The second route, and the reason it exists.
 *
 * A SPA only looks correct until somebody types `/projects` into the address
 * bar or reloads on it. That request goes to the server, not to the router,
 * and unless the server answers a path it has never heard of with the same
 * `index.html`, the dashboard 404s on every page but the first. Loading this
 * one directly is the check.
 */
function Projects() {
  const result = Route.useLoaderData();

  return (
    <Page>
      <PageHeader
        title="Projects"
        meta={
          <Text variant="mono-sm" tone="tertiary">
            GET /api/projects
          </Text>
        }
      />

      {result.success ? (
        <ul className="flex max-w-xl flex-col gap-px overflow-hidden rounded-md border border-border">
          {result.data.items.length === 0 ? (
            <li className="bg-surface p-4">
              <Text variant="body" tone="muted">
                No projects yet.
              </Text>
            </li>
          ) : (
            result.data.items.map((project) => (
              <li
                key={project.id}
                className="flex items-baseline justify-between gap-4 bg-surface p-4"
              >
                <Text variant="body">{project.name}</Text>
                <Text variant="mono-sm" tone="tertiary">
                  {project.slug}
                </Text>
              </li>
            ))
          )}
        </ul>
      ) : (
        <div className="flex max-w-xl items-center gap-3 rounded-md border border-border bg-surface p-4">
          <Tag
            tone={result.error.kind === 'unauthenticated' ? 'info' : 'error'}
            variant="soft"
          >
            {result.error.kind}
          </Tag>
          <Text variant="body" tone="secondary">
            {result.error.message}
          </Text>
        </div>
      )}
    </Page>
  );
}
