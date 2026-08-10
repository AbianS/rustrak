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
 * caller's translator, so the sentences can be localised without this module
 * importing anything framework-shaped. When no translator is passed, an
 * internal English dictionary stands in, so a caller that cannot reach one
 * still gets a sentence rather than a blank slot.
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

/** The message keys this module resolves, and their English forms. */
const EN: Record<string, string> = {
  'error.describe.networkTimeout': 'The Rustrak API took too long to answer.',
  'error.describe.networkUnreachable': 'The Rustrak API could not be reached.',
  'error.describe.serverError':
    'The Rustrak API failed while answering. Try again in a moment.',
  'error.describe.forbidden': 'Your account is not allowed to do this.',
  'error.describe.rateLimited': 'Too many requests. Try again {window}.',
  'error.describe.invalidResponse':
    'The Rustrak API answered with data this dashboard could not read.',
  'error.guidance.network':
    'You are still signed in. Reload the page once the API is back.',
  'error.guidance.rateLimited':
    'This limit usually comes from a proxy in front of Rustrak rather than from Rustrak itself.',
  'error.guidance.forbidden':
    'Ask an administrator if you think you should have access.',
  'error.guidance.invalidResponse':
    'The dashboard and the API are probably running different versions. Reloading will not help.',
  'error.guidance.notFound':
    'The server answered normally; it just had nothing at that address.',
  'error.headline.network': 'Rustrak is not responding',
  'error.headline.forbidden': 'You do not have access',
  'error.headline.rateLimited': 'Too many requests',
  'error.headline.invalidResponse': 'This dashboard could not read the API',
  'error.headline.notFound': 'Nothing here',
  'error.headline.other': 'That did not work',
  'error.retry.moments': 'in a moment',
  'error.retry.seconds': 'in {count} seconds',
  'error.retry.minutes': 'in about {count} minutes',
  'error.retry.hours': 'in about {count} hours',
};

/** Resolve one key through `t` when present, the English dictionary otherwise. */
function text(
  t: Translate | undefined,
  key: string,
  values?: Record<string, string | number>,
): string {
  if (t) return t(key, values);
  let message = EN[key] ?? key;
  for (const [name, value] of Object.entries(values ?? {})) {
    message = message.replaceAll(`{${name}}`, String(value));
  }
  return message;
}

/**
 * What went wrong, in one sentence.
 */
export function describeError(error: RustrakError, t?: Translate): string {
  switch (error.kind) {
    case 'network':
      return error.reason === 'timeout'
        ? text(t, 'error.describe.networkTimeout')
        : text(t, 'error.describe.networkUnreachable');
    case 'server_error':
      return text(t, 'error.describe.serverError');
    case 'forbidden':
      return text(t, 'error.describe.forbidden');
    case 'rate_limited':
      return text(t, 'error.describe.rateLimited', {
        window: retryWindow(error.retryAfter, t),
      });
    case 'invalid_response':
      return text(t, 'error.describe.invalidResponse');
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
  t?: Translate,
): string | null {
  switch (error.kind) {
    case 'network':
    case 'server_error':
      return text(t, 'error.guidance.network');
    case 'rate_limited':
      return text(t, 'error.guidance.rateLimited');
    case 'forbidden':
      return text(t, 'error.guidance.forbidden');
    case 'invalid_response':
      return text(t, 'error.guidance.invalidResponse');
    case 'not_found':
      return text(t, 'error.guidance.notFound');
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
export function errorHeadline(error: RustrakError, t?: Translate): string {
  switch (error.kind) {
    case 'network':
    case 'server_error':
      return text(t, 'error.headline.network');
    case 'forbidden':
      return text(t, 'error.headline.forbidden');
    case 'rate_limited':
      return text(t, 'error.headline.rateLimited');
    case 'invalid_response':
      return text(t, 'error.headline.invalidResponse');
    case 'not_found':
      return text(t, 'error.headline.notFound');
    default:
      return text(t, 'error.headline.other');
  }
}

/**
 * Turns `Retry-After` seconds into something a person can act on.
 *
 * The value was already parsed by the client (including the HTTP-date form) and
 * was previously dropped on the floor, so a proxy answering `Retry-After: 3600`
 * rendered as "in a moment" and the user reloaded for an hour.
 */
function retryWindow(
  retryAfter: number | undefined,
  t: Translate | undefined,
): string {
  if (retryAfter === undefined || retryAfter <= 0) {
    return text(t, 'error.retry.moments');
  }
  if (retryAfter < 60) {
    return text(t, 'error.retry.seconds', { count: retryAfter });
  }

  const minutes = Math.round(retryAfter / 60);
  if (minutes < 60) {
    return text(t, 'error.retry.minutes', { count: minutes });
  }

  const hours = Math.round(retryAfter / 3600);
  return text(t, 'error.retry.hours', { count: hours });
}
