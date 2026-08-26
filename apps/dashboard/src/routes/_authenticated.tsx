import { activate, createTranslator } from '@rustrak/i18n';
import {
  AppShell,
  Button,
  Text,
  Topbar,
  TopbarBrand,
  TopbarUser,
} from '@rustrak/ui';
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouter,
} from '@tanstack/react-router';
import { localeFor } from '../lib/locale';

// Pathless: files under `routes/_authenticated/` are guarded without any route
// having to opt in.
//
// No sidebar. These are the screens that are not scoped to one project, so
// there is nothing to navigate within; the rail belongs to a project layout,
// under `/projects/$id`.
export const Route = createFileRoute('/_authenticated')({
  /**
   * Only `anonymous` redirects. `unreachable` means the server did not answer,
   * and bouncing to `/login` would loop there for the same reason.
   */
  beforeLoad: async ({ context, location }) => {
    const session = await context.auth.ensure();

    if (session.state === 'anonymous') {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }

    return { session };
  },
  // The design system's own copy, loaded once for everything under here.
  /*
   * The design system's own copy. `activate` puts the translator where
   * `@rustrak/ui` reads it from -- a module singleton, not a provider -- so
   * nothing has to be wrapped and the components stay usable outside React.
   */
  loader: async ({ context }) => {
    activate(
      await createTranslator({
        locale: localeFor(context.session),
        namespaces: ['ui'],
      }),
    );
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { auth, session } = Route.useRouteContext();
  const router = useRouter();

  // Clear before navigating: `/login`'s guard would otherwise still see the
  // old session and send them straight back.
  async function signOut() {
    await auth.signOut();
    await router.navigate({ to: '/login', search: { redirect: '/' } });
  }

  return (
    <AppShell
      topbar={
        <Topbar
          actions={
            session.state === 'authenticated' ? (
              <TopbarUser
                actions={[
                  {
                    id: 'sign-out',
                    label: 'Sign out',
                    onSelect: signOut,
                    separated: true,
                    tone: 'danger',
                  },
                ]}
                email={session.user.email}
                name={session.user.email}
              />
            ) : null
          }
          brand={<TopbarBrand render={<Link to="/" />} />}
        />
      }
    >
      {session.state === 'unreachable' ? (
        <Disconnected message={session.error.message} />
      ) : (
        <Outlet />
      )}
    </AppShell>
  );
}

// Names no user and no project: this is the one branch that renders without a
// confirmed session.
function Disconnected({ message }: { message: string }) {
  const router = useRouter();

  return (
    <div className="flex h-full items-center justify-center p-page-gutter">
      <div className="flex max-w-md flex-col gap-3 rounded-md border border-border bg-surface p-6">
        <h2 className="text-card-title text-fg">The server did not answer</h2>
        <Text variant="body" tone="secondary">
          {message}
        </Text>
        <Text variant="hint" tone="muted">
          Your session has not been ended. Once the server is reachable again
          this page picks up where it left off.
        </Text>
        <div className="mt-1 flex">
          <Button variant="secondary" onClick={() => router.invalidate()}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
