import { cookies } from 'next/headers';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import {
  FALLBACK_TIME_ZONE,
  isValidTimeZone,
  TIME_ZONE_COOKIE,
} from './timezone';

/**
 * The reader's zone, or {@link FALLBACK_TIME_ZONE} when it is unknown.
 *
 * Lives here rather than beside the constants it uses, because `next/headers`
 * is server-only and `timezone.ts` is imported by the client component that
 * writes the cookie. Putting the read there dragged the poison pill into the
 * browser bundle and 500'd every page.
 */
async function getTimeZone(): Promise<string> {
  const cookieStore = await cookies();
  const value = cookieStore.get(TIME_ZONE_COOKIE)?.value;

  if (!value || !isValidTimeZone(value)) {
    return FALLBACK_TIME_ZONE;
  }
  return value;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const timeZone = await getTimeZone();

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
