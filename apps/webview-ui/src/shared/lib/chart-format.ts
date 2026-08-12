/**
 * Formatting shared by the overview charts and stat tiles.
 *
 * **What used to be here and why it left.** `compactCount` and `exactCount`
 * lived in this file and pinned the locale: one built
 * `new Intl.NumberFormat('en')` at module scope, the other called
 * `value.toLocaleString()` with no argument, which resolves whatever locale the
 * *process* defaults to. A reader on `/zh` got "12.4K" where the locale says
 * "1.2万", and the same number could format differently on the server and in
 * the browser that hydrated it.
 *
 * Both are now `format.number(value, 'compact')` and `format.number(value)`
 * from next-intl's `useFormatter` / `getFormatter`, with the option sets named
 * in `i18n/request.ts`. That reads the request locale, and it keeps the reason
 * the old module-scope constant existed: next-intl memoises the underlying
 * `Intl` instances, so a per-cell call does not rebuild a formatter.
 *
 * What stays here is what has no locale in it: arithmetic.
 */

/**
 * Relative change from `previous` to `current`.
 *
 * Returns `null` when there is nothing to compare against: no previous window
 * at all (an all-time request), or a previous window of zero, where any
 * increase is an undefined percentage rather than "+100%".
 *
 * Rendered with `format.number(change, 'percentChange')`, which carries the
 * sign and the percent sign in the reader's locale. The version of this file
 * before the i18n pass did that with `toFixed(1)` and a hand-written `+`,
 * which hard-codes a decimal point and a sign position that not every locale
 * writes the same way.
 */
export function percentChange(
  current: number,
  previous: number | null,
): number | null {
  if (previous === null || previous === 0) {
    return null;
  }
  return (current - previous) / previous;
}
