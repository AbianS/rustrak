/**
 * The languages the dashboard is written in.
 *
 * **No `defineRouting`, because the locale is not in the URL.** It was, for one
 * unmerged branch: every route sat under `/[locale]`, a proxy prefixed every
 * request, and 51 files navigated through a wrapper that kept the prefix on.
 * That apparatus buys indexable per-language URLs and per-locale caching, and
 * an internal dashboard behind a login has use for neither.
 *
 * It also cost something real. A link pasted to a colleague opened in the
 * *sender's* language rather than the reader's, which is backwards for a tool a
 * team shares.
 *
 * The locale comes from the reader: `users.language` once they have chosen,
 * and `Accept-Language` before that. No cookie is involved -- a preference
 * that lives on the account follows the reader to any browser they log in
 * from, which a cookie cannot do. See `request.ts`.
 */

export const LOCALES = ['en', 'zh'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Whether `value` is a language this app actually has messages for. */
export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (LOCALES as readonly string[]).includes(value);
}
