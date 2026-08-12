import { getLocale } from 'next-intl/server';
import { redirect as navigateRedirect } from './navigation';

/**
 * Locale-aware `redirect` for server components.
 *
 * `createNavigation`'s redirect needs the target locale passed explicitly, and
 * every call site inside `[locale]` knows it from the request context. This
 * wrapper keeps call sites identical to the pre-i18n form (`redirect('/x')`)
 * while handing the locale to next-intl.
 *
 * Server-only by construction: it reads the request locale. The client-safe
 * members of the navigation API live in `navigation.ts`; do not import this
 * module from a client component.
 */
export async function redirect(href: string): Promise<never> {
  const locale = await getLocale();
  return navigateRedirect({ href, locale });
}
