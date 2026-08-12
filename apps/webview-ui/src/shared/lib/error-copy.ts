import type { RustrakError } from '@rustrak/client';

/**
 * The app's own sentences for a `RustrakError`, chosen from `kind`.
 *
 * One module rather than one per surface, because a failure reads the same
 * whether it lands on a full-page card, in a single tile, or under a form
 * input. Before this existed the page surfaces branched on `kind` and the forms
 * did not, so an unreachable API said "The Rustrak API could not be reached."
 * on a page and "Failed to create project" in a dialog.
 *
 * `network` and `server_error` carry a fixed, redacted `message` by design (the
 * real ones name the deployment's internal host, or a database error), so their
 * copy is written here. The rest carry a message the server meant a human to
 * read, and it is rendered rather than replaced.
 *
 * **Why a translator parameter.** This module is part of the portable core,
 * which does not know Next. Every sentence is a message key resolved by the
 * caller's translator, so the copy can be localised without this module
 * importing anything framework-shaped.
 *
 * **And why it is required.** It was optional, with a table of 21 English
 * sentences in this file standing in when it was omitted -- a second dictionary
 * keyed by the same message keys as `messages/en.json`. All eleven call sites
 * passed a translator, so the table was unreachable code that could only ever
 * drift out of sync with the file it duplicated. A required parameter is one
 * source of truth and one compile error at any call site that forgets.
 */

/**
 * The smallest translator shape the core needs: `t(key, values)` -> string.
 *
 * next-intl's `t` from `useTranslations` / `getTranslations` satisfies it.
 */
export type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

/**
 * What went wrong, in one sentence.
 */
export function describeError(error: RustrakError, t: Translate): string {
  switch (error.kind) {
    case 'network':
      return error.reason === 'timeout'
        ? t('error.describe.networkTimeout')
        : t('error.describe.networkUnreachable');
    case 'server_error':
      return t('error.describe.serverError');
    case 'forbidden':
      return t('error.describe.forbidden');
    case 'rate_limited':
      return t('error.describe.rateLimited', {
        window: retryWindow(error.retryAfter, t),
      });
    case 'invalid_response':
      return t('error.describe.invalidResponse');
    default:
      return error.message;
  }
}

/**
 * What the reader should do about it, or `null` when there is nothing useful
 * to add.
 *
 * This is the half that used to be a single hardcoded line. "You are still
 * signed in, reload once the API is back" is true for an outage and actively
 * misleading for everything else: it tells a user who lacks permission, or
 * whose dashboard is a version ahead of its API, to wait for a server that is
 * already up.
 */
export function errorGuidance(
  error: RustrakError,
  t: Translate,
): string | null {
  switch (error.kind) {
    case 'network':
    case 'server_error':
      return t('error.guidance.network');
    case 'rate_limited':
      return t('error.guidance.rateLimited');
    case 'forbidden':
      return t('error.guidance.forbidden');
    case 'invalid_response':
      return t('error.guidance.invalidResponse');
    case 'not_found':
      return t('error.guidance.notFound');
    default:
      // validation, conflict, gone, payload_too_large, client_error,
      // invalid_request, unauthenticated: the message already says everything
      // the reader can act on, and a second line would only pad it.
      return null;
  }
}

/**
 * The heading for a surface that is giving the whole viewport to this failure.
 *
 * Only the two genuine outage kinds get to claim the API is down.
 */
export function errorHeadline(error: RustrakError, t: Translate): string {
  switch (error.kind) {
    case 'network':
    case 'server_error':
      return t('error.headline.network');
    case 'forbidden':
      return t('error.headline.forbidden');
    case 'rate_limited':
      return t('error.headline.rateLimited');
    case 'invalid_response':
      return t('error.headline.invalidResponse');
    case 'not_found':
      return t('error.headline.notFound');
    default:
      return t('error.headline.other');
  }
}

/**
 * Turns `Retry-After` seconds into something a person can act on.
 *
 * The value was already parsed by the client (including the HTTP-date form) and
 * was previously dropped on the floor, so a proxy answering `Retry-After: 3600`
 * rendered as "in a moment" and the user reloaded for an hour.
 */
function retryWindow(retryAfter: number | undefined, t: Translate): string {
  if (retryAfter === undefined || retryAfter <= 0) {
    return t('error.retry.moments');
  }
  if (retryAfter < 60) {
    return t('error.retry.seconds', { count: retryAfter });
  }

  const minutes = Math.round(retryAfter / 60);
  if (minutes < 60) {
    return t('error.retry.minutes', { count: minutes });
  }

  const hours = Math.round(retryAfter / 3600);
  return t('error.retry.hours', { count: hours });
}
