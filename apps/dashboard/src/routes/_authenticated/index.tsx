import {
  Button,
  Page,
  PageHeader,
  RefreshIcon,
  Separator,
  Tag,
  Text,
} from '@rustrak/ui';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { rustrak } from '../../lib/rustrak';

export const Route = createFileRoute('/_authenticated/')({
  /**
   * The one request that proves the whole chain: bundle to origin, origin to
   * Actix, Actix back through `@rustrak/client`'s Zod schema into a typed
   * `Result`. In development it crosses the Vite proxy on the way; in
   * production it never leaves the process serving this page.
   *
   * `/health/version` is authenticated on purpose -- a version number tells a
   * stranger which advisories apply to your instance -- so a signed-out
   * browser gets `unauthenticated` here. That is a successful round trip too,
   * and the page says so rather than pretending it failed.
   */
  loader: () => rustrak.health.getVersion(),
  component: Overview,
});

function Overview() {
  const result = Route.useLoaderData();
  const router = useRouter();

  return (
    <Page>
      <PageHeader
        title="Overview"
        meta={
          <Text variant="mono-sm" tone="tertiary">
            {window.location.origin}
          </Text>
        }
        actions={
          <Button
            variant="secondary"
            icon={RefreshIcon}
            onClick={() => router.invalidate()}
          >
            Retry
          </Button>
        }
      />

      <div className="max-w-xl rounded-md border border-border bg-surface p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-card-title text-fg">API connection</h2>
          {result.success ? (
            <Tag tone="brand" variant="soft">
              connected
            </Tag>
          ) : (
            <Tag
              tone={result.error.kind === 'unauthenticated' ? 'info' : 'error'}
              variant="soft"
            >
              {result.error.kind}
            </Tag>
          )}
        </div>

        <Separator className="my-4" />

        {result.success ? (
          <div className="flex items-baseline gap-2">
            <Text variant="label" tone="tertiary">
              Server version
            </Text>
            <Text variant="mono" tone="brand">
              {result.data.version}
            </Text>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Text variant="body" tone="secondary">
              {result.error.message}
            </Text>
            {result.error.kind === 'unauthenticated' ? (
              <Text variant="hint" tone="muted">
                The round trip worked. Sign in to read the version.
              </Text>
            ) : null}
          </div>
        )}
      </div>
    </Page>
  );
}
