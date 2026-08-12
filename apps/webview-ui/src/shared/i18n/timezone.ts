/**
 * Which clock the dashboard renders timestamps against.
 *
 * **The model is Sentry's, and Sentry does not default to UTC.**
 * `timezoneProvider.tsx` resolves `user.options.timezone ?? browserTimezone`,
 * where the browser zone is `Intl.DateTimeFormat().resolvedOptions().timeZone`.
 * UTC is never the default there; it is a per-range override on the date
 * filter, and the one case their `DateTime` component labels the zone for,
 * because a reader seeing UTC needs to be told it is not their own clock.
 *
 * Rustrak cannot copy that directly. Sentry's frontend is a SPA, so it reads
 * `Intl` on the client and is done; every timestamp here is rendered by a
 * Server Component, and the browser's zone reaches no server. It is not in a
 * header, and there is no request field that carries it. So the browser writes
 * it to a cookie (`TimeZoneCookie`) and `request.ts` reads it back.
 *
 * **Nothing here may import `next/headers`.** `TimeZoneCookie` is a client
 * component and needs {@link TIME_ZONE_COOKIE}, so a server-only import in this
 * module travels into the browser bundle with it. That is not theoretical: this
 * file held the cookie *read* for one revision, and every page 500'd with
 * "You're importing a module that depends on next/headers". Reading the cookie
 * lives in `request.ts`, which is server-only by construction.
 *
 * What is deliberately *not* implemented is Sentry's other half: a persisted
 * `user.options.timezone` that follows the account across devices, and
 * `clock24Hours`. Both need a column and an endpoint on the Rust side, tracked
 * in rustrak/rustrak#258. The 12/24-hour clock is less of a loss than it looks
 * -- `Intl` already picks it from the locale, so `en` reads "2:50 PM" and `zh`
 * reads "14:50" without a preference existing.
 */

/**
 * Named to match the locale cookie next-intl writes, so the pair reads as one
 * thing in devtools.
 */
export const TIME_ZONE_COOKIE = 'NEXT_TIME_ZONE';

/**
 * Where a reader with no cookie lands.
 *
 * UTC rather than a guess from the locale: `zh` is spoken across four offsets
 * and `en` across a dozen, so deriving a zone from the language would be wrong
 * more often than it was right, and wrong in a way nobody would notice. UTC is
 * at least visibly not-local, and it is what the timestamps already say on the
 * wire.
 */
export const FALLBACK_TIME_ZONE = 'UTC';

/**
 * Whether `value` is a zone this runtime can actually format with.
 *
 * The cookie is user-controlled input, and `Intl` throws `RangeError` on a name
 * it does not know. Unvalidated, one hand-edited cookie would take down every
 * page that renders a date rather than spoiling one value.
 *
 * Checked against the runtime's own list rather than by constructing a
 * formatter and catching: `locale-completeness` forbids `new Intl.*` in source
 * for good reason, and a rule that has to carve out an exception is a rule
 * people learn to carve out of.
 */
export function isValidTimeZone(value: string): boolean {
  try {
    return Intl.supportedValuesOf('timeZone').includes(value);
  } catch {
    // A runtime without `supportedValuesOf` cannot be asked. Falling back to
    // UTC beats trusting the cookie.
    return false;
  }
}
