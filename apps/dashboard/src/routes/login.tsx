import { createTranslator, resolveLocale } from '@rustrak/i18n';
import { Text, Wordmark } from '@rustrak/ui';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { IncidentField } from '../components/login/incident-field';
import { LoginForm } from '../components/login/login-form';
import { sanitizeRedirect } from '../lib/auth';

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: sanitizeRedirect(search.redirect),
  }),
  // Already signed in: go where they were headed, so back-after-login
  // does not show a filled-in form.
  beforeLoad: async ({ context, search }) => {
    const session = await context.auth.ensure();
    if (session.state === 'authenticated') {
      throw redirect({ href: search.redirect });
    }
  },
  /**
   * Nobody is signed in here, so there is no stored preference to read: the
   * browser's list is all there is. `auth` is the only namespace this page
   * names, which is what keeps it from carrying the copy for project deletion.
   */
  loader: () =>
    createTranslator({
      locale: resolveLocale({ preferred: navigator.languages }),
      namespaces: ['auth'],
    }),
  component: LoginPage,
});

function LoginPage() {
  const { auth } = Route.useRouteContext();
  const t = Route.useLoaderData();
  const search = Route.useSearch();
  const router = useRouter();

  return (
    <div className="flex h-full bg-canvas">
      {/* `data-field-surface`: the art answers a cursor anywhere on the panel. */}
      <aside
        className="hidden w-155 shrink-0 flex-col justify-between border-r border-border-subtle bg-panel p-13 lg:flex"
        data-field-surface
      >
        <div className="flex shrink-0">
          <Wordmark className="h-wordmark-brand w-auto" still />
        </div>

        <div className="flex shrink-0 flex-col gap-8">
          <h2 className="max-w-108 text-balance text-display text-fg">
            {t.t('auth.panel.headline')}
          </h2>

          <IncidentField />

          <Text
            className="max-w-100 text-pretty"
            tone="tertiary"
            variant="body"
          >
            {t.t('auth.panel.caption')}
          </Text>
        </div>

        <Text tone="ghost" variant="mono-sm">
          © 2026 Rustrak
        </Text>
      </aside>

      <main className="flex flex-1 items-center justify-center p-page-gutter">
        <LoginForm
          t={t}
          onSubmit={async (credentials) => {
            const session = await auth.signIn(credentials);

            if (session.state === 'authenticated') {
              // `href` and not `to`: the destination is a runtime string the
              // guard captured, not one of the router's known literals.
              await router.navigate({ href: search.redirect });
              return { rejected: false };
            }

            /*
             * No per-field error: naming which half was wrong confirms whether
             * an address has an account. The server keeps the three outcomes
             * indistinguishable in wording and in time. See
             * `auth/credentials.rs`.
             */
            return session.state === 'anonymous'
              ? { rejected: true }
              : { rejected: false, error: session.error };
          }}
        />
      </main>
    </div>
  );
}
