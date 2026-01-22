import { RustrakClient } from '@rustrak/client';
import { cookies } from 'next/headers';

/**
 * The name of the session cookie used by the Rustrak server.
 * Must match the cookie_name configured in the server's SessionMiddleware.
 */
const SESSION_COOKIE_NAME = 'rustrak_session';

/**
 * Create a RustrakClient instance with the current user's session cookie.
 * Use this in Server Actions and Server Components to make authenticated requests.
 *
 * @example
 * ```typescript
 * // In a Server Action
 * export async function getProjects() {
 *   const client = await createClient();
 *   return client.projects.list();
 * }
 * ```
 */
export async function createClient(): Promise<RustrakClient> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  // Only send the session cookie, not all cookies
  const cookieHeader = sessionCookie
    ? `${SESSION_COOKIE_NAME}=${sessionCookie.value}`
    : '';

  return new RustrakClient({
    baseUrl: process.env.RUSTRAK_API_URL ?? 'http://localhost:8080',
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  });
}

/**
 * Parse a Set-Cookie header string and return its components.
 * Used to extract cookie attributes for setting cookies in Server Actions.
 */
function parseSetCookie(setCookieHeader: string): {
  name: string;
  value: string;
  path?: string;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
} {
  const parts = setCookieHeader.split(';').map((p) => p.trim());
  const [nameValue, ...attributes] = parts;
  // Split only on the first '=' to handle values containing '='
  const eqIndex = nameValue.indexOf('=');
  const name = eqIndex > 0 ? nameValue.slice(0, eqIndex) : nameValue;
  const value = eqIndex > 0 ? nameValue.slice(eqIndex + 1) : '';

  const result: ReturnType<typeof parseSetCookie> = {
    name,
    value: value ?? '',
  };

  for (const attr of attributes) {
    const [key, val] = attr.split('=');
    const keyLower = key.toLowerCase();

    switch (keyLower) {
      case 'path':
        result.path = val;
        break;
      case 'max-age':
        result.maxAge = parseInt(val, 10);
        break;
      case 'httponly':
        result.httpOnly = true;
        break;
      case 'secure':
        result.secure = true;
        break;
      case 'samesite':
        result.sameSite = val.toLowerCase() as 'strict' | 'lax' | 'none';
        break;
    }
  }

  return result;
}

/**
 * Apply Set-Cookie headers from a backend response to the Next.js cookie store.
 * Use this after login/register to persist the session cookie.
 *
 * @example
 * ```typescript
 * // In a Server Action
 * export async function login(credentials: LoginRequest) {
 *   const client = await createClient();
 *   const result = await client.auth.login(credentials);
 *   await applySetCookies(result.cookies);
 *   return result.user;
 * }
 * ```
 */
export async function applySetCookies(
  setCookieHeaders: string[],
): Promise<void> {
  const cookieStore = await cookies();

  for (const header of setCookieHeaders) {
    const parsed = parseSetCookie(header);

    // Decode the cookie value to prevent double-encoding.
    // The backend (actix-session) URL-encodes the cookie value,
    // and Next.js cookieStore.set() will encode it again.
    // By decoding first, we ensure the final value is only single-encoded.
    const decodedValue = decodeURIComponent(parsed.value);

    cookieStore.set(parsed.name, decodedValue, {
      path: parsed.path,
      maxAge: parsed.maxAge,
      httpOnly: parsed.httpOnly,
      secure: parsed.secure,
      sameSite: parsed.sameSite,
    });
  }
}

/**
 * Clear all session-related cookies.
 * Use this after logout to clear the session.
 */
export async function clearSessionCookies(
  setCookieHeaders: string[],
): Promise<void> {
  const cookieStore = await cookies();

  for (const header of setCookieHeaders) {
    const parsed = parseSetCookie(header);
    // If maxAge is 0 or negative, or value is empty, delete the cookie
    if (parsed.maxAge !== undefined && parsed.maxAge <= 0) {
      cookieStore.delete(parsed.name);
    } else {
      // Apply the cookie as-is (backend might set expiration)
      // Decode to prevent double-encoding (same as applySetCookies)
      const decodedValue = decodeURIComponent(parsed.value);
      cookieStore.set(parsed.name, decodedValue, {
        path: parsed.path,
        maxAge: parsed.maxAge,
        httpOnly: parsed.httpOnly,
        secure: parsed.secure,
        sameSite: parsed.sameSite,
      });
    }
  }
}
