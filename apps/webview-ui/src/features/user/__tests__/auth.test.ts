import type { Result, RustrakError, User } from '@rustrak/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentUserMock = vi.fn<() => Promise<Result<User, RustrakError>>>();

vi.mock('@/shared/api/rustrak', () => ({
  createClient: async () => ({ auth: { getCurrentUser: getCurrentUserMock } }),
  applySetCookies: vi.fn(),
  clearSessionCookies: vi.fn(),
  dropSessionCookie: vi.fn(),
}));

const user: User = {
  id: 1,
  email: 'a@example.com',
  role: 'admin',
  is_admin: true,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
} as User;

describe('getCurrentUser', () => {
  beforeEach(() => {
    vi.resetModules();
    getCurrentUserMock.mockReset();
  });

  async function subject() {
    const { getCurrentUser } = await import('@/features/user/api/queries');
    return getCurrentUser();
  }

  it('is authenticated when the client returns a user', async () => {
    getCurrentUserMock.mockResolvedValue({ success: true, data: user });

    await expect(subject()).resolves.toEqual({
      state: 'authenticated',
      user,
    });
  });

  it('is anonymous for unauthenticated, the one state that may redirect', async () => {
    getCurrentUserMock.mockResolvedValue({
      success: false,
      error: { kind: 'unauthenticated', status: 401, message: 'Unauthorized' },
    });

    await expect(subject()).resolves.toEqual({ state: 'anonymous' });
  });

  // The regression this whole conversion exists to prevent. Every one of these
  // used to collapse to `null`, and eight pages read that `null` as "log in
  // again": a user on a flaky connection was bounced to `/auth/login`
  // repeatedly, and logging in did not help because the next request failed the
  // same way. None of them may ever be `anonymous`.
  const notLoggedOut: RustrakError[] = [
    { kind: 'network', message: 'unreachable', reason: 'unreachable' },
    { kind: 'network', message: 'timed out', reason: 'timeout' },
    { kind: 'server_error', status: 500, message: 'boom' },
    { kind: 'server_error', status: 503, message: 'boom' },
    { kind: 'forbidden', status: 403, message: 'Forbidden' },
    { kind: 'not_found', status: 404, message: 'Not found' },
    { kind: 'invalid_response', message: 'bad body' },
    { kind: 'rate_limited', status: 429, message: 'Slow down' },
    { kind: 'client_error', status: 418, message: 'Teapot' },
  ];

  for (const error of notLoggedOut) {
    it(
      `is unavailable, never anonymous, for ${error.kind} ${'status' in error ? error.status : ((error as { reason?: string }).reason ?? '')}`.trim(),
      async () => {
        getCurrentUserMock.mockResolvedValue({ success: false, error });

        const session = await subject();

        expect(session.state).toBe('unavailable');
        expect(session.state).not.toBe('anonymous');
        expect(session).toEqual({ state: 'unavailable', error });
      },
    );
  }
});
