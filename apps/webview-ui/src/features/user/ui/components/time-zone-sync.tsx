'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { updatePreferences } from '@/features/user/api/mutations';

/**
 * Adopts the browser's timezone onto the account, once, for a reader who has
 * never set one.
 *
 * **Why this exists at all.** A language can be inferred from a header;
 * `Accept-Language` is sent on every request. A timezone cannot -- it appears
 * in no header, and only `Intl` in the browser knows it. So a reader who never
 * opens a timezone setting would read every timestamp in UTC forever, which is
 * the behaviour this whole thread set out to remove.
 *
 * Sentry has the same problem and solves it in the browser, because their
 * frontend renders there: `timezoneProvider.tsx` falls back to
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` at render time. Ours
 * renders on the server, so the value has to be sent once and stored.
 *
 * **Once, and only when unset.** `hasTimeZone` is what the server already knows
 * about this user; when it is true this component does nothing and never
 * re-runs. That is deliberate: a reader who deliberately picked `UTC` while
 * sitting in Madrid must not have it silently overwritten on their next visit.
 * The trade is that a reader who moves country keeps their old zone until they
 * change it, which is the same trade Sentry makes with a stored preference.
 *
 * The ref guards against the effect running twice in Strict Mode and firing two
 * writes for the same value.
 */
export function TimeZoneSync({ hasTimeZone }: { hasTimeZone: boolean }) {
  const router = useRouter();
  const attempted = useRef(false);

  useEffect(() => {
    if (hasTimeZone || attempted.current) return;
    attempted.current = true;

    let zone: string;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!zone) return;

    updatePreferences({ timezone: zone }).then((result) => {
      // Silent on failure, deliberately. This runs unprompted on someone
      // else's screen; a toast about a preference they never touched would be
      // noise, and the only cost of failing is that timestamps stay in UTC
      // until the next page load tries again.
      if (result.success) router.refresh();
    });
  }, [hasTimeZone, router]);

  return null;
}
