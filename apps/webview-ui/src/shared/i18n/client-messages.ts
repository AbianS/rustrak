import type { Messages } from 'next-intl';

/**
 * Which slice of the dictionary crosses into the browser, and where.
 *
 * `NextIntlClientProvider` serialises whatever it is given into the RSC payload
 * of every page under it. One provider at the root handed all 30 namespaces to
 * all 33 routes, which made `/auth/login` -- the one page a visitor sees before
 * they are anyone -- a 113KB document carrying the copy for source-map cleanup
 * and project deletion. Measured on the built app, not inferred.
 *
 * Splitting it is worth exactly one thing, and it is worth it a lot: the
 * unauthenticated pages drop from 48KB of messages to 6KB. Inside `(main)` the
 * saving is small, because a dashboard where nearly everything is interactive
 * genuinely needs 25 of the 31 namespaces on the client. That asymmetry is the
 * whole design here: two sets, not one per route.
 *
 * **Nested providers do not merge.** next-intl treats `messages` as atomic, so
 * `(main)`'s provider passes the union rather than a delta. `MAIN` below is
 * that union, spelled out.
 */

/**
 * The shell: everything outside `(main)`, which is the login and the
 * invitation, plus the error and not-found screens.
 *
 * `error` and `formErrors` are here rather than in `MAIN` because the login and
 * invitation forms resolve server rejections through them, and those are the
 * forms most likely to meet one.
 */
export const SHELL_NAMESPACES = [
  'auth',
  'common',
  'error',
  'errorScreen',
  'errors',
  'formErrors',
  'invite',
  'theme',
  'update',
] as const;

/**
 * The authenticated dashboard: the shell's set plus everything its own screens
 * name.
 *
 * `commands` is in here for a reason that is easy to miss: the command bar
 * resolves `labelKey` strings out of `shared/config/commands.ts` through a
 * global `useTranslations()`, so no `useTranslations('commands')` call names it
 * and a scan for named namespaces would leave it out. Six other client
 * components resolve keys the same way.
 */
export const MAIN_NAMESPACES = [
  ...SHELL_NAMESPACES,
  'agents',
  'alertTypes',
  'alerts',
  'charts',
  'commands',
  'events',
  'issues',
  // Only the language field on /settings/account names it, and that page is
  // inside `(main)`. It was in SHELL while the switcher lived in the header.
  'locale',
  'logs',
  'platforms',
  'projectPages',
  'projects',
  'releases',
  'roles',
  'settings',
  'statTile',
  'storage',
  'table',
  'tokens',
  'transactions',
  'user',
] as const;

/** The dictionary reduced to `namespaces`, for handing to a provider. */
export function pickMessages(
  messages: Messages,
  namespaces: readonly string[],
): Messages {
  const picked: Messages = {};
  for (const namespace of namespaces) {
    if (namespace in messages) picked[namespace] = messages[namespace];
  }
  return picked;
}
