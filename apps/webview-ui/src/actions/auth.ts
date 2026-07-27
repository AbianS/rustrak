'use server';

import type {
  AcceptInvitation,
  InvitationInfo,
  LoginRequest,
  RustrakError,
  User,
} from '@rustrak/client';
import {
  applySetCookies,
  clearSessionCookies,
  createClient,
  dropSessionCookie,
} from '@/lib/rustrak';

export type LoginResult =
  | { success: true; user: User }
  | {
      success: false;
      error: 'invalid_credentials' | 'unreachable' | 'rate_limited' | 'unknown';
      /** Seconds the caller should wait, when the server or a proxy said so. */
      retryAfter?: number;
    };

/**
 * Login with email and password.
 * Sets the session cookie automatically.
 *
 * @param credentials - Email and password
 * @returns Result object with success status and user or error type
 */
export async function login(credentials: LoginRequest): Promise<LoginResult> {
  const client = await createClient();
  const result = await client.auth.login(credentials);

  if (!result.success) {
    switch (result.error.kind) {
      case 'unauthenticated':
        // Deliberately vague, and deliberately identical whether the email is
        // unknown, the password is wrong, or the account is disabled. Naming
        // which one it was is user enumeration: the server checks `is_active`
        // *before* it verifies the password, so a distinct "account disabled"
        // answer would confirm an address exists to anyone who typed it.
        //
        // It is also not currently distinguishable. All three are
        // `Unauthorized` with only the prose differing, and matching on prose
        // is the string-matching this refactor exists to delete. Telling them
        // apart needs a discriminator on the wire from `apps/server`.
        return { success: false, error: 'invalid_credentials' };
      case 'network':
        // Split out from `unknown`: "we could not reach the server" is a
        // different instruction to the user than "your details were rejected",
        // and collapsing the two is what makes a login page feel broken.
        return { success: false, error: 'unreachable' };
      case 'rate_limited':
        // Also split out, and for a sharper reason than the others: the
        // generic copy ends "Please try again", which is the one instruction
        // that extends a lockout. Self-hosted instances commonly sit behind an
        // nginx or Cloudflare rule on `/auth/login`, so this is the failure a
        // user retrying by hand is most likely to meet.
        return {
          success: false,
          error: 'rate_limited',
          retryAfter: result.error.retryAfter,
        };
      default:
        return { success: false, error: 'unknown' };
    }
  }

  // Apply session cookies from backend response
  await applySetCookies(result.data.cookies);

  return { success: true, user: result.data.user };
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

export type GetInvitationResult =
  | { success: true; invitation: InvitationInfo }
  | { success: false; error: 'invalid' | 'unknown' };

/**
 * Fetch public information about an invitation by its token.
 * Used by the public accept-invitation page (no auth required).
 *
 * @param token - The invitation token
 * @returns Result with the invitation info or an error type
 */
export async function getInvitation(
  token: string,
): Promise<GetInvitationResult> {
  const client = await createClient();
  const result = await client.auth.getInvitation(token);

  if (result.success) {
    return { success: true, invitation: result.data };
  }

  switch (result.error.kind) {
    // The three ways the server says "this token buys you nothing": never
    // issued, malformed, or expired/already used.
    case 'not_found':
    case 'validation':
    case 'gone':
      return { success: false, error: 'invalid' };
    default:
      return { success: false, error: 'unknown' };
  }
}

export type AcceptInvitationResult =
  | { success: true; user: User }
  | { success: false; error: string };

/**
 * Accept an invitation by setting a password.
 * On success the backend creates a session; the cookie is persisted here.
 *
 * @param input - The invitation token and chosen password
 * @returns Result with the new user or a friendly error message
 */
export async function acceptInvitation(
  input: AcceptInvitation,
): Promise<AcceptInvitationResult> {
  const client = await createClient();
  const result = await client.auth.acceptInvitation(input);

  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  // Apply session cookies so the user is logged in immediately
  await applySetCookies(result.data.cookies);

  return { success: true, user: result.data.user };
}
