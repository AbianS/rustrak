'use server';

import type { LoginRequest, User } from '@rustrak/client';
import { RustrakError } from '@rustrak/client';
import {
  applySetCookies,
  clearSessionCookies,
  createClient,
} from '@/lib/rustrak';

export type LoginResult =
  | { success: true; user: User }
  | { success: false; error: 'invalid_credentials' | 'unknown' };

/**
 * Login with email and password.
 * Sets the session cookie automatically.
 *
 * @param credentials - Email and password
 * @returns Result object with success status and user or error type
 */
export async function login(credentials: LoginRequest): Promise<LoginResult> {
  try {
    const client = await createClient();
    const result = await client.auth.login(credentials);

    // Apply session cookies from backend response
    await applySetCookies(result.cookies);

    return { success: true, user: result.user };
  } catch (err) {
    // Check for authentication error (401)
    if (err instanceof RustrakError && err.statusCode === 401) {
      return { success: false, error: 'invalid_credentials' };
    }
    return { success: false, error: 'unknown' };
  }
}

/**
 * Logout the current user.
 * Clears the session cookie.
 */
export async function logout(): Promise<void> {
  const client = await createClient();
  const cookies = await client.auth.logout();

  // Clear session cookies
  await clearSessionCookies(cookies);
}

/**
 * Get the currently authenticated user.
 * Returns null if not authenticated (instead of throwing).
 *
 * @returns The current user or null if not authenticated
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const client = await createClient();
    return await client.auth.getCurrentUser();
  } catch (err) {
    // Return null only for authentication errors (401)
    if (err instanceof RustrakError && err.statusCode === 401) {
      return null;
    }
    // Log other errors for debugging but still return null
    // to avoid breaking the app on transient errors
    console.error('Failed to get current user:', err);
    return null;
  }
}
