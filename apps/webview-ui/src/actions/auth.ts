'use server';

import type {
  ChangePasswordRequest,
  LoginRequest,
  RegisterRequest,
  User,
} from '@rustrak/client';
import { RustrakError } from '@rustrak/client';
import {
  applySetCookies,
  clearSessionCookies,
  createClient,
} from '@/lib/rustrak';

export type LoginResult =
  | { success: true; user: User }
  | { success: false; error: 'invalid_credentials' | 'unknown' };

export type RegisterResult =
  | { success: true; user: User }
  | { success: false; error: 'email_exists' | 'weak_password' | 'unknown'; message?: string };

export type ChangePasswordResult =
  | { success: true }
  | { success: false; error: 'invalid_current_password' | 'weak_password' | 'unknown'; message?: string };

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

/**
 * Register a new user account.
 * Sets the session cookie automatically on success.
 *
 * @param credentials - Email and password for the new account
 * @returns Result object with success status and user or error type
 */
export async function register(credentials: RegisterRequest): Promise<RegisterResult> {
  try {
    const client = await createClient();
    const result = await client.auth.register(credentials);

    // Apply session cookies from backend response
    await applySetCookies(result.cookies);

    return { success: true, user: result.user };
  } catch (err) {
    if (err instanceof RustrakError) {
      // Email already exists (409 Conflict or validation error)
      if (err.statusCode === 409 || (err.statusCode === 400 && err.message.includes('Email already exists'))) {
        return { success: false, error: 'email_exists' };
      }
      // Weak password (400 with password validation message)
      if (err.statusCode === 400 && err.message.includes('Password')) {
        return { success: false, error: 'weak_password', message: err.message };
      }
    }
    return { success: false, error: 'unknown' };
  }
}

/**
 * Change the current user's password.
 * Requires the correct current password.
 *
 * @param request - Current password and new password
 * @returns Result object with success status or error type
 */
export async function changePassword(request: ChangePasswordRequest): Promise<ChangePasswordResult> {
  try {
    const client = await createClient();
    await client.auth.changePassword(request);
    return { success: true };
  } catch (err) {
    if (err instanceof RustrakError) {
      // Invalid current password (401)
      if (err.statusCode === 401) {
        return { success: false, error: 'invalid_current_password' };
      }
      // Weak password (400 with password validation message)
      if (err.statusCode === 400 && err.message.includes('Password')) {
        return { success: false, error: 'weak_password', message: err.message };
      }
    }
    return { success: false, error: 'unknown' };
  }
}
