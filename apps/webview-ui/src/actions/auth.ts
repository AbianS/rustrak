'use server';

import type {
  AcceptInvitation,
  InvitationInfo,
  LoginRequest,
  Result,
  RustrakError,
  User,
} from '@rustrak/client';
import {
  applySetCookies,
  clearSessionCookies,
  createClient,
  dropSessionCookie,
} from '@/lib/rustrak';

/**
 * Login with email and password, applying the session cookies on success.
 *
 * Returns the client's own `Result` like every other action here. It used to
 * translate the failure into a domain enum, and that layer bought nothing: the
 * server answers the same `Unauthorized` whether the email is unknown, the
 * password is wrong, or the account is disabled, so the client already reports
 * a single `unauthenticated` and there is nothing left to collapse.
 *
 * Deciding that `unauthenticated` deserves one deliberately vague sentence is a
 * *presentation* decision and lives in the form, next to the other copy. See
 * `login-form.tsx`, which explains why that vagueness is deliberate.
 *
 * The success arm is narrowed to the user on purpose: `result.data` also holds
 * the `Set-Cookie` headers, which are applied here and must not travel to a
 * Client Component.
 */
export async function login(
  credentials: LoginRequest,
): Promise<Result<User, RustrakError>> {
  const client = await createClient();
  const result = await client.auth.login(credentials);

  if (!result.success) return result;

  await applySetCookies(result.data.cookies);

  return { success: true, data: result.data.user };
}

/**
 * Logout the current user.
 * Clears the session cookie.
 */
export async function logout(): Promise<void> {
  const client = await createClient();
  const result = await client.auth.logout();

  if (!result.success) {
    // The server did not acknowledge, so there are no `Set-Cookie` headers to
    // replay. Drop the cookie anyway: a logout that leaves the session cookie
    // in place is a session the user believes has ended and has not, which is
    // the worse of the two failures on a shared machine.
    await dropSessionCookie();
    return;
  }

  await clearSessionCookies(result.data);
}

/**
 * Whether there is a session, and if not, why not.
 *
 * Three states, not a nullable user. `anonymous` is the *only* one that may
 * send the visitor to `/auth/login`: an unreachable API or a 5xx is
 * `unavailable`, and redirecting on those turns a flaky connection into a
 * login loop that logging in cannot fix, because the next request fails the
 * same way. A 403 is `unavailable` too, since it means "signed in, not
 * allowed", which login also does not fix.
 */
export type CurrentUser =
  | { state: 'authenticated'; user: User }
  | { state: 'anonymous' }
  | { state: 'unavailable'; error: RustrakError };

/**
 * Get the currently authenticated user.
 *
 * @returns Which of the three states the session is in
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const client = await createClient();
  const result = await client.auth.getCurrentUser();

  if (result.success) {
    return { state: 'authenticated', user: result.data };
  }

  if (result.error.kind === 'unauthenticated') {
    return { state: 'anonymous' };
  }

  return { state: 'unavailable', error: result.error };
}

/**
 * Fetch public information about an invitation by its token.
 * Used by the public accept-invitation page (no auth required).
 *
 * The three kinds that mean "this token buys you nothing" -- `not_found`,
 * `validation` and `gone`, for never issued, malformed, and expired or already
 * used -- are no longer folded into one verdict here. The page branches on
 * `kind` itself, which keeps the distinction available to whoever wants it and
 * keeps this action a pass-through like the other 74.
 */
export async function getInvitation(
  token: string,
): Promise<Result<InvitationInfo, RustrakError>> {
  const client = await createClient();
  return client.auth.getInvitation(token);
}

/**
 * Accept an invitation by setting a password.
 * On success the backend creates a session; the cookie is persisted here.
 *
 * Narrowed to the user for the same reason as {@link login}: `result.data` also
 * carries the `Set-Cookie` headers, which are applied here and must not reach a
 * Client Component.
 */
export async function acceptInvitation(
  input: AcceptInvitation,
): Promise<Result<User, RustrakError>> {
  const client = await createClient();
  const result = await client.auth.acceptInvitation(input);

  if (!result.success) return result;

  await applySetCookies(result.data.cookies);

  return { success: true, data: result.data.user };
}
