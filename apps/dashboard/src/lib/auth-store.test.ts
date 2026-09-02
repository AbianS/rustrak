import type { LoginResult, Result, RustrakError, User } from '@rustrak/client';
import { describe, expect, it, vi } from 'vitest';
import { type AuthApi, createAuthStore, sanitizeRedirect } from './auth-store';

const USER = {
  id: 1,
  email: 'marta@acme.com',
  role: 'admin',
  is_admin: true,
  language: null,
  timezone: null,
} as unknown as User;

const ok = <T>(data: T): Result<T, RustrakError> => ({ success: true, data });
const err = (error: RustrakError): Result<never, RustrakError> => ({
  success: false,
  error,
});

const UNAUTHENTICATED = {
  kind: 'unauthenticated',
  message: 'Unauthorized',
} as RustrakError;
const OFFLINE = { kind: 'network', message: 'Failed to fetch' } as RustrakError;

function stub(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    getCurrentUser: vi.fn(async () => ok(USER)),
    login: vi.fn(async () => ok({ user: USER, cookies: [] } as LoginResult)),
    logout: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('who the server says is reading', () => {
  it('reads a 401 as nobody being signed in', async () => {
    const store = createAuthStore(
      stub({
        getCurrentUser: async () => err(UNAUTHENTICATED),
      }),
    );

    expect(await store.ensure()).toEqual({ state: 'anonymous' });
  });

  it('does not read an unreachable server as being signed out', async () => {
    // Reading this as `anonymous` loops: bounce to /login, where the request
    // fails the same way.
    const store = createAuthStore(
      stub({
        getCurrentUser: async () => err(OFFLINE),
      }),
    );

    expect(await store.ensure()).toEqual({
      state: 'unreachable',
      error: OFFLINE,
    });
  });

  it('asks once however many guards want the answer', async () => {
    const api = stub();
    const store = createAuthStore(api);

    await Promise.all([store.ensure(), store.ensure(), store.ensure()]);

    expect(api.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it('keeps the answer once it has one', async () => {
    const api = stub();
    const store = createAuthStore(api);

    await store.ensure();
    await store.ensure();

    expect(api.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it('asks again after the server did not answer', async () => {
    // What "Try again" on the disconnected panel calls. Holding the settled
    // `unreachable` would leave that panel up until a full page reload.
    let reachable = false;
    const api = stub({
      getCurrentUser: vi.fn(async () =>
        reachable ? ok(USER) : err(OFFLINE),
      ) as AuthApi['getCurrentUser'],
    });
    const store = createAuthStore(api);

    expect(await store.ensure()).toEqual({
      state: 'unreachable',
      error: OFFLINE,
    });

    reachable = true;

    expect(await store.ensure()).toEqual({
      state: 'authenticated',
      user: USER,
    });
    expect(api.getCurrentUser).toHaveBeenCalledTimes(2);
  });
});

describe('signing in', () => {
  it('takes the user from the login response instead of asking again', async () => {
    const api = stub();
    const store = createAuthStore(api);

    await store.signIn({ email: USER.email, password: 'hunter2' });
    await store.ensure();

    expect(api.getCurrentUser).not.toHaveBeenCalled();
    expect(store.peek()).toEqual({ state: 'authenticated', user: USER });
  });

  it('leaves a standing session alone when the attempt is rejected', async () => {
    // Two tabs: a mistyped password in one must not sign the other out.
    const api = stub({ login: async () => err(UNAUTHENTICATED) });
    const store = createAuthStore(api);
    await store.ensure();

    const attempt = await store.signIn({
      email: USER.email,
      password: 'wrong',
    });

    expect(attempt).toEqual({ state: 'anonymous' });
    expect(store.peek()).toEqual({ state: 'authenticated', user: USER });
  });

  it('separates a rejection from a server that did not answer', async () => {
    const store = createAuthStore(stub({ login: async () => err(OFFLINE) }));

    expect(
      await store.signIn({ email: USER.email, password: 'hunter2' }),
    ).toEqual({ state: 'unreachable', error: OFFLINE });
  });
});

describe('signing out', () => {
  it('drops the session and makes the next guard ask the server', async () => {
    const api = stub();
    const store = createAuthStore(api);
    await store.ensure();

    await store.signOut();

    expect(store.peek()).toEqual({ state: 'anonymous' });
    await store.ensure();
    expect(api.getCurrentUser).toHaveBeenCalledTimes(2);
  });

  it('still ends the session locally when the request fails', async () => {
    // Must not fail open: the browser was told to sign out.
    const store = createAuthStore(
      stub({
        logout: async () => {
          throw new Error('offline');
        },
      }),
    );
    await store.ensure();

    await expect(store.signOut()).resolves.toBeUndefined();
    expect(store.peek()).toEqual({ state: 'anonymous' });
  });

  it('tells subscribers', async () => {
    const store = createAuthStore(stub());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    await store.ensure();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await store.signOut();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('where a redirect is allowed to point', () => {
  it('keeps a path on this origin', () => {
    expect(sanitizeRedirect('/projects?page=2')).toBe('/projects?page=2');
  });

  it.each<{ value: unknown; why: string }>([
    { value: 'https://evil.example/login', why: 'an absolute URL' },
    { value: '//evil.example', why: 'a protocol-relative URL' },
    { value: '/\\evil.example', why: 'a backslash host' },
    { value: 'javascript:alert(1)', why: 'a script URL' },
    { value: undefined, why: 'nothing at all' },
    { value: 42, why: 'something that is not a string' },
  ])('refuses $why', ({ value }) => {
    expect(sanitizeRedirect(value)).toBe('/');
  });
});
