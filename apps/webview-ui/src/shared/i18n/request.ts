import { headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { createClient } from '@/shared/api/rustrak';
import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from './routing';

/** The authenticated user, or `null` before anyone has logged in. */
type SessionUser = {
  language?: string | null;
  timezone?: string | null;
} | null;

/**
 * Who is asking, for preference purposes only.
 *
 * Deliberately not `features/user`'s `getCurrentUser`, even though it answers
 * the same question: `shared` may not reach into `features`, and
 * `layer-direction` fails the build for trying -- it caught this exact import.
 * `shared/api` is a sibling segment and already owns client construction, so
 * the read belongs here.
 *
 * Every failure collapses to "nobody is asking", because a request config that
 * throws takes the page with it, and an unreadable session is not a reason to
 * fail to render a login form.
 */
async function sessionUser(): Promise<SessionUser> {
  try {
    const client = await createClient();
    const result = await client.auth.getCurrentUser();
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Where a reader with no stored zone lands.
 *
 * UTC rather than a guess: it is the zone the events arrive in and the one the
 * logs a reader correlates against are already written in. `TimeZoneSync`
 * replaces it with the browser's on the first authenticated render.
 */
const FALLBACK_TIME_ZONE = 'UTC';

/** Whether `value` is a zone this runtime can actually format with. */
function isValidTimeZone(value: string): boolean {
  try {
    return Intl.supportedValuesOf('timeZone').includes(value);
  } catch {
    return false;
  }
}

/**
 * Which language to answer this request in.
 *
 * **The locale is not in the URL, so nothing upstream has decided it.** With no
 * proxy running there is no `requestLocale` to read, and next-intl requires the
 * config to return one explicitly -- its own error says so: "the proxy /
 * middleware didn't run on this request and no `locale` was returned in
 * `getRequestConfig`".
 *
 * The order is the reader's choice first, then their browser's, then English:
 *
 * 1. **`users.language`**, chosen on `/settings/account`. It lives on the
 *    account rather than in a cookie so it follows the reader to any browser
 *    they log in from, and survives clearing site data.
 * 2. **`Accept-Language`**, which is all there is before anyone is
 *    authenticated -- the login, the invitation and the 404 all render with no
 *    user to read a preference from. Matched on the base tag, so `zh-CN`,
 *    `zh-TW` and `zh-Hans` all reach `zh`.
 * 3. **English**, because a dashboard has to render something.
 *
 * The stored value is validated rather than trusted: the server accepts any
 * well-formed language tag by design (it has no business knowing which ones
 * this dashboard ships), so `pt-BR` can legitimately be in the column while
 * there are no Portuguese messages to render.
 */
async function getLocale(user: SessionUser): Promise<Locale> {
  const chosen = user?.language ?? undefined;
  if (isLocale(chosen)) return chosen;

  const accepted = (await headers()).get('accept-language');
  if (accepted) {
    for (const part of accepted.split(',')) {
      // "zh-CN;q=0.9" -> "zh". Quality values are dropped rather than sorted
      // on: browsers already send this list in preference order.
      const base = part.split(';')[0].trim().split('-')[0].toLowerCase();
      const match = LOCALES.find((locale) => locale === base);
      if (match) return match;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * The reader's zone, or {@link FALLBACK_TIME_ZONE} when they have none.
 *
 * Validated rather than trusted: the API accepts any well-formed zone name by
 * design, and `Intl` throws `RangeError` on a name it does not know, which in
 * here would take down every page that renders a date.
 */
function timeZoneOf(stored: string | null | undefined): string {
  if (!stored || !isValidTimeZone(stored)) return FALLBACK_TIME_ZONE;
  return stored;
}

export default getRequestConfig(async () => {
  // One read of the session for both preferences: everything below depends on
  // who is asking.
  const user = await sessionUser();

  const locale = await getLocale(user);
  const timeZone = timeZoneOf(user?.timezone);

  /**
   * Sentry's rule, and it is a good one.
   *
   * `dateTime.tsx` shows the zone only when the time is UTC, on the reasoning
   * that "the user would want to know that it's UTC and not their own time
   * zone". A local time needs no label because it matches the reader's own
   * clock; a UTC time looks exactly like a local one and is silently two hours
   * out. The suffix appears precisely where it would otherwise mislead.
   *
   * Here UTC means one of two things, and both want the label: the reader has
   * not told us their zone yet, or they genuinely run on UTC.
   */
  const showZone = timeZone === FALLBACK_TIME_ZONE;

  return {
    locale,
    timeZone,
    messages: (await import(`./messages/${locale}.json`)).default,

    /**
     * One "now" for the whole request.
     *
     * Without it every `format.relativeTime` call reached for its own
     * `new Date()`, which next-intl warns about (`ENVIRONMENT_FALLBACK`) for
     * two reasons that both bite here. Two rows rendered microseconds apart
     * were measured against two different clocks, so a list of timestamps
     * could disagree with itself at a boundary. And the value the server
     * computed was not the value the browser recomputed on hydration, which is
     * a mismatch waiting for a slow connection to expose it.
     *
     * Set here rather than at the call sites because next-intl hands it to
     * `NextIntlClientProvider` along with the rest of the config, so the client
     * hydrates against the same instant the server rendered.
     *
     * Relative times therefore do not tick on their own. That is the right
     * default for a dashboard whose rows are minutes to weeks old; a surface
     * that genuinely needs a live clock asks for one with
     * `useNow({updateInterval})`.
     */
    now: new Date(),

    /**
     * The option sets, named once.
     *
     * These replace 8 distinct `date-fns` pattern strings ('PPpp', 'MMM d',
     * 'MMM d, HH:mm', ...) that were spread across 19 files and drifting: the
     * same kind of value read three different ways depending on which component
     * rendered it. A name here also means a call site says *what* it is showing
     * rather than how, so a change to how a chart axis reads is one edit.
     *
     * `formats` is inherited by `NextIntlClientProvider` automatically, so the
     * client-side charts resolve the same names.
     */
    formats: {
      dateTime: {
        /**
         * A calendar day. "Jan 5, 2026" / "2026年1月5日".
         *
         * No zone suffix even under `showZone`: a date with no time on it is
         * not a clock reading, and "Jan 5, 2026 UTC" invites the reader to
         * wonder which day it is for them.
         */
        date: { year: 'numeric', month: 'short', day: 'numeric' },
        /** A day and a wall-clock time, the default for a timestamp. */
        dateTime: {
          dateStyle: 'medium',
          timeStyle: showZone ? 'long' : 'short',
        },
        /** With seconds, for log lines and event ingestion stamps. */
        precise: {
          dateStyle: 'medium',
          timeStyle: showZone ? 'long' : 'medium',
        },
        /** Time only, for a breadcrumb inside one event. */
        time: {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          ...(showZone ? { timeZoneName: 'short' as const } : {}),
        },
        /** A chart tick where the bucket is a day or wider. */
        axisDay: { month: 'short', day: 'numeric' },
        /** A chart tick where the bucket is narrower than a day. */
        axisTime: {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        },
      },
      number: {
        /** `12403` -> "12.4K" in English, "1.2万" in Chinese. */
        compact: { notation: 'compact', maximumFractionDigits: 1 },
        /** `0.183` -> "18.3%". A rate, where a sign would be meaningless. */
        percent: { style: 'percent', maximumFractionDigits: 1 },
        /** `0.183` -> "+18.3%". Signed, because the sign is the point. */
        percentChange: {
          style: 'percent',
          signDisplay: 'exceptZero',
          maximumFractionDigits: 1,
        },
      },
    },
  };
});
