import type { RustrakError } from '@rustrak/client';
import { notFound, redirect } from 'next/navigation';
import { ServiceUnavailable } from '@/components/service-unavailable';

/**
 * What a Server Component renders when a `Result` it needed came back a
 * failure.
 *
 * Three outcomes, and which one you get is decided by `kind` alone:
 *
 * - `unauthenticated` is the *only* kind that sends the visitor to login. The
 *   `(main)` layout already gated the request, so reaching this means the
 *   session expired between the gate and the fetch.
 * - `not_found` renders the app's 404. A project-scoped endpoint answering 404
 *   means the project, issue or event in the URL is gone, which is a wrong
 *   address rather than an outage.
 * - everything else renders an outage surface, in place, with no navigation.
 *   An unreachable API must never look like a missing record or a signed-out
 *   session, because neither of those is something the user can act on.
 *
 * `title` says which fetch failed, so a page that loads several things does not
 * leave the reader guessing which one is missing.
 */
export function LoadFailure({
  error,
  title,
  notFoundOnMissing = true,
}: {
  error: RustrakError;
  title: string;
  /**
   * Set `false` where a 404 is not "the thing in the URL is gone" but "this
   * particular endpoint had nothing", so the surrounding page survives it.
   */
  notFoundOnMissing?: boolean;
}) {
  if (error.kind === 'unauthenticated') {
    redirect('/auth/login');
  }

  if (error.kind === 'not_found' && notFoundOnMissing) {
    notFound();
  }

  return <ServiceUnavailable error={error} title={title} />;
}
