import type {
  LoginRequest,
  LoginResult,
  Result,
  RustrakError,
  User,
} from '@rustrak/client';

/**
 * Three states and not two: `@rustrak/client` is explicit that only
 * `unauthenticated` means signed out. Reading a dropped connection as
 * `anonymous` bounces to `/login`, where the request fails the same way.
 */
export type Session =
  | { state: 'authenticated'; user: User }
  | { state: 'anonymous' }
  | { state: 'unreachable'; error: RustrakError };

export interface AuthStore {
  /** Memoises the in-flight request, so nested guards share one `/auth/me`. */
  ensure(): Promise<Session>;
  /** The settled session, or `undefined` before `ensure()` resolves. */
  peek(): Session | undefined;
  signIn(credentials: LoginRequest): Promise<Session>;
  signOut(): Promise<void>;
  subscribe(listener: () => void): () => void;
}

/** The three endpoints the store needs, named so tests can stub them. */
export interface AuthApi {
  getCurrentUser(): Promise<Result<User, RustrakError>>;
  login(credentials: LoginRequest): Promise<Result<LoginResult, RustrakError>>;
  logout(): Promise<unknown>;
}

export function createAuthStore(api: AuthApi): AuthStore {
  let inFlight: Promise<Session> | null = null;
  let settled: Session | undefined;
  const listeners = new Set<() => void>();

  function publish(session: Session) {
    settled = session;
    for (const listener of listeners) listener();
    return session;
  }

  async function ask(): Promise<Session> {
    const result = await api.getCurrentUser();

    if (result.success) {
      return publish({ state: 'authenticated', user: result.data });
    }
    if (result.error.kind === 'unauthenticated') {
      return publish({ state: 'anonymous' });
    }
    return publish({ state: 'unreachable', error: result.error });
  }

  return {
    ensure() {
      inFlight ??= ask();
      return inFlight;
    },

    peek() {
      return settled;
    },

    async signIn(credentials) {
      const result = await api.login(credentials);

      if (!result.success) {
        // Deliberately does not publish: a mistyped password in one tab must
        // not sign the session out in another.
        return result.error.kind === 'unauthenticated'
          ? { state: 'anonymous' }
          : { state: 'unreachable', error: result.error };
      }

      const session: Session = {
        state: 'authenticated',
        user: result.data.user,
      };
      inFlight = Promise.resolve(session);
      return publish(session);
    },

    async signOut() {
      // Cleared whether or not the request lands. It is not a claim that the
      // server session ended. The next guard asks and gets the truth.
      try {
        await api.logout();
      } catch {}

      inFlight = null;
      publish({ state: 'anonymous' });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * `redirect` is attacker-controlled, so only a path on this origin survives.
 * `//host` and `/\host` are absolute URLs wearing a path's clothes.
 */
export function sanitizeRedirect(value: unknown): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  if (value.startsWith('/\\')) return '/';
  return value;
}
