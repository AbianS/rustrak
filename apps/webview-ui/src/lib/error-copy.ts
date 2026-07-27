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
 */

/**
 * What went wrong, in one sentence.
 */
export function describeError(error: RustrakError): string {
  switch (error.kind) {
    case 'network':
      return error.reason === 'timeout'
        ? 'The Rustrak API took too long to answer.'
        : 'The Rustrak API could not be reached.';
    case 'server_error':
      return 'The Rustrak API failed while answering. Try again in a moment.';
    case 'forbidden':
      return 'Your account is not allowed to do this.';
    case 'rate_limited':
      return `Too many requests. Try again ${retryWindow(error.retryAfter)}.`;
    case 'invalid_response':
      // Not the server's fault and not the user's: the two halves disagree
      // about the shape of the data, which is a deployment problem.
      return 'The Rustrak API answered with data this dashboard could not read.';
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
export function errorGuidance(error: RustrakError): string | null {
  switch (error.kind) {
    case 'network':
    case 'server_error':
      return 'You are still signed in. Reload the page once the API is back.';
    case 'rate_limited':
      return 'This limit usually comes from a proxy in front of Rustrak rather than from Rustrak itself.';
    case 'forbidden':
      return 'Ask an administrator if you think you should have access.';
    case 'invalid_response':
      return 'The dashboard and the API are probably running different versions. Reloading will not help.';
    case 'not_found':
      return 'The server answered normally; it just had nothing at that address.';
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
export function errorHeadline(error: RustrakError): string {
  switch (error.kind) {
    case 'network':
    case 'server_error':
      return 'Rustrak is not responding';
    case 'forbidden':
      return 'You do not have access';
    case 'rate_limited':
      return 'Too many requests';
    case 'invalid_response':
      return 'This dashboard could not read the API';
    case 'not_found':
      return 'Nothing here';
    default:
      return 'That did not work';
  }
}

/**
 * Turns `Retry-After` seconds into something a person can act on.
 *
 * The value was already parsed by the client (including the HTTP-date form) and
 * was previously dropped on the floor, so a proxy answering `Retry-After: 3600`
 * rendered as "in a moment" and the user reloaded for an hour.
 */
function retryWindow(retryAfter: number | undefined): string {
  if (retryAfter === undefined || retryAfter <= 0) return 'in a moment';
  if (retryAfter < 60) return `in ${retryAfter} seconds`;

  const minutes = Math.round(retryAfter / 60);
  if (minutes < 60)
    return `in about ${minutes} minute${minutes === 1 ? '' : 's'}`;

  const hours = Math.round(retryAfter / 3600);
  return `in about ${hours} hour${hours === 1 ? '' : 's'}`;
}
