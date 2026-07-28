import type { RustrakError, User } from '@rustrak/client';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '@/features/user/api/queries';

const getCurrentUser = vi.fn<() => Promise<CurrentUser>>();

/** Stands in for Next's `redirect`, which also aborts by throwing. */
class RedirectSignal extends Error {
  constructor(readonly to: string) {
    super(`redirect(${to})`);
  }
}

const redirect = vi.fn((to: string): never => {
  throw new RedirectSignal(to);
});

vi.mock('next/navigation', () => ({ redirect: (to: string) => redirect(to) }));
vi.mock('@/features/user/api/queries', () => ({
  getCurrentUser: () => getCurrentUser(),
}));
vi.mock('@/shared/ui/update-banner-slot', () => ({
  UpdateBannerSlot: () => null,
}));
vi.mock('@/features/user/ui/header', () => ({
  Header: ({ user }: { user: User }) => <div>header for {user.email}</div>,
}));

const user = { id: 1, email: 'a@example.com', role: 'admin' } as User;

async function renderLayout() {
  const { default: MainLayout } = await import('../layout');
  return MainLayout({ children: <p>protected content</p> });
}

describe('(main)/layout auth gate', () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    redirect.mockClear();
  });

  it('renders the app for an authenticated session', async () => {
    getCurrentUser.mockResolvedValue({ state: 'authenticated', user });

    render(await renderLayout());

    expect(redirect).not.toHaveBeenCalled();
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  it('redirects to login when the session is anonymous', async () => {
    getCurrentUser.mockResolvedValue({ state: 'anonymous' });

    await expect(renderLayout()).rejects.toBeInstanceOf(RedirectSignal);
    expect(redirect).toHaveBeenCalledWith('/auth/login');
  });

  // The one regression a user would actually notice, and the only test in this
  // suite that would catch it. Redirecting here sends someone whose session is
  // perfectly valid to a login form that cannot help: logging in issues the
  // same request, it fails the same way, and they are bounced again.
  // `headline` is asserted per kind rather than as one shared string, because
  // only `network` and `server_error` are entitled to claim the API is down.
  // Telling someone who lacks permission, or whose dashboard is a version
  // ahead of its API, to "reload once the API is back" points them at a server
  // that is already answering.
  const outages: { error: RustrakError; headline: RegExp }[] = [
    {
      error: { kind: 'network', message: 'unreachable', reason: 'unreachable' },
      headline: /not responding/i,
    },
    {
      error: { kind: 'network', message: 'timed out', reason: 'timeout' },
      headline: /not responding/i,
    },
    {
      error: { kind: 'server_error', status: 500, message: 'boom' },
      headline: /not responding/i,
    },
    {
      error: { kind: 'server_error', status: 502, message: 'boom' },
      headline: /not responding/i,
    },
    {
      error: { kind: 'forbidden', status: 403, message: 'Forbidden' },
      headline: /do not have access/i,
    },
    {
      error: { kind: 'invalid_response', message: 'bad body' },
      headline: /could not read the API/i,
    },
  ];

  for (const { error, headline } of outages) {
    it(`does not redirect on ${error.kind}, it reports the outage`, async () => {
      getCurrentUser.mockResolvedValue({ state: 'unavailable', error });

      render(await renderLayout());

      expect(redirect).not.toHaveBeenCalled();
      expect(screen.getByText(headline)).toBeInTheDocument();
      // And the protected tree stays unrendered: every page below assumes it
      // has a user, so handing them one that does not exist trades a login
      // loop for a crash.
      expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    });
  }

  // The guidance line is the half that used to be hardcoded. Asserting its
  // *absence* for a non-outage is the point: a `forbidden` told to wait for
  // the API to come back is worse than no guidance at all.
  it('does not tell a forbidden user to wait for the API', async () => {
    getCurrentUser.mockResolvedValue({
      state: 'unavailable',
      error: { kind: 'forbidden', status: 403, message: 'Forbidden' },
    });

    render(await renderLayout());

    expect(screen.queryByText(/once the API is back/i)).not.toBeInTheDocument();
  });
});
