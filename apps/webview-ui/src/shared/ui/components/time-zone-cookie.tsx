'use client';

import { useEffect } from 'react';
import { TIME_ZONE_COOKIE } from '@/shared/i18n/timezone';

/**
 * Tells the server which clock this browser is on.
 *
 * The one piece of Sentry's timezone model that does not port directly. Their
 * frontend reads `Intl.DateTimeFormat().resolvedOptions().timeZone` in the
 * component that renders the date, because every date there is rendered in the
 * browser. Here they are rendered by Server Components, and the browser's zone
 * reaches no server on its own: it is in no header and no request field. A
 * cookie is the only channel, so the browser opens it.
 *
 * **An effect, and the timing genuinely does not matter.** This was first
 * written as an inline `<script>` so it would run before paint, then as
 * `next/script` with `beforeInteractive` when React pointed out that a script
 * tag rendered by a component never executes on the client. Both were solving
 * a problem that does not exist: nothing in *this* render reads the cookie.
 * It is read by `getTimeZone()` on the *next* request, so a value written
 * during paint and a value written one commit later are the same value. The
 * effect is the version with no framework-internal behaviour to trust.
 *
 * The cost is one render's worth of fallback: a visitor with no cookie yet
 * sees UTC. In practice that render is the login page, which shows no
 * timestamps, and by the time the session redirect lands the cookie is set.
 *
 * It rewrites on every mount rather than checking first. Zones change under a
 * reader who travels or whose laptop crosses a DST boundary, the write is a
 * string assignment, and a "has it changed" check costs more than it saves.
 *
 * `SameSite=Lax` because this is read on ordinary navigations and never wanted
 * on a cross-site POST. Not `Secure`, because the dashboard is routinely run on
 * plain HTTP behind a VPN and a `Secure` cookie would silently never be set
 * there, which is the failure mode this component exists to avoid.
 */
export function TimeZoneCookie() {
  useEffect(() => {
    let zone: string;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!zone) return;

    // Biome points at the Cookie Store API here, and it is the better API: it
    // replaces a named cookie rather than appending to a string that already
    // holds every other one. It is also not available everywhere a self-hosted
    // dashboard gets opened, so taking it would mean keeping this line as the
    // fallback anyway. One well-formed write, with the value encoded, is the
    // smaller thing to be right about.
    // biome-ignore lint/suspicious/noDocumentCookie: needs a fallback for browsers without cookieStore
    document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(zone)};path=/;max-age=31536000;samesite=lax`;
  }, []);

  return null;
}
