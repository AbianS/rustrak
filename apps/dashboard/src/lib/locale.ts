import { type Locale, resolveLocale } from '@rustrak/i18n';
import type { Session } from './auth-store';

/**
 * The language for a signed-in reader.
 *
 * The account's choice first, then the browser. `users.language` lives on the
 * account so it follows them to any browser they sign in from.
 */
export function localeFor(session: Session): Locale {
  return resolveLocale({
    stored: session.state === 'authenticated' ? session.user.language : null,
    preferred: typeof navigator === 'undefined' ? null : navigator.languages,
  });
}
