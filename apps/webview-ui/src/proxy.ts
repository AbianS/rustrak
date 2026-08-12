import createMiddleware from 'next-intl/middleware';
import { routing } from './shared/i18n/routing';

export default createMiddleware(routing);

/**
 * One pattern, not four.
 *
 * The version this replaced listed `'/'` and `'/(en|zh)/:path*'` alongside the
 * catch-all that already matched both, and excluded `trpc`, which this app has
 * never had. Copied from the next-intl example and never read since.
 *
 * What the exclusions actually mean here:
 *
 * - `_next` and `_vercel` are the framework's own paths. Rewriting them breaks
 *   the build output and the RSC payload requests.
 * - `api` is not this app's concern: reads go straight to `RUSTRAK_API_URL`
 *   from Server Components, and writes are Server Actions, so there are no
 *   route handlers to protect. It stays because a future one would want it.
 * - Static assets are excluded **by extension**, so `/icon.png` and
 *   `/apple-icon.png` reach their generated routes instead of being redirected
 *   to `/en/icon.png`.
 *
 * That last exclusion is where the bug was. The next-intl example writes it as
 * `.*\..*` -- anything containing a dot -- and `/v1.0/auth/login` contains a
 * dot, so it skipped the proxy entirely and rendered the whole dashboard under
 * `<html lang="v1.0">`. Matching a closed list of extensions at the end of the
 * path costs one longer regex and turns that URL back into what it is: a path
 * with no locale, which the proxy prefixes and the app then 404s with its own
 * branded page.
 *
 * `[locale]/layout.tsx` still checks the segment with `hasLocale`. Two layers
 * for one hole is deliberate: this one is a list that will fall behind the next
 * asset type someone adds, and that one cannot.
 *
 * Written out rather than composed from an `ASSET_EXTENSIONS` constant: Next
 * reads this export statically and rejects anything it cannot evaluate at build
 * time, template literal included ("need to be static strings").
 */
export const config = {
  matcher: [
    '/((?!api|_next|_vercel|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|avif|txt|xml|json|webmanifest|js|css|map|woff|woff2|ttf|otf|pdf|mp4|webm)$).*)',
  ],
};
