import { notFound } from 'next/navigation';

/**
 * Every path under a valid locale that matched no other route.
 *
 * Without it, `/zh/does-not-exist` matched nothing at all, so Next fell back to
 * its own unstyled "404: This page could not be found." on a white background.
 * `[locale]/not-found.tsx` could not answer: a `not-found` renders when
 * something *inside* its segment raises `notFound()`, and an unmatched URL
 * never reaches the segment to raise anything.
 *
 * This route is what reaches it. Because the proxy prefixes every non-asset
 * path with a locale before it gets here, every unmatched URL in the app ends
 * up under a valid `[locale]` and lands on this page, which raises the failure
 * from *inside* the segment so the shell can render the real 404 around it:
 * translated, branded, with its links carrying the reader's locale.
 *
 * **Next's `global-not-found.tsx` is the other way to do this, and it was
 * tried and rejected.** It renders outside the locale layout, so it has no
 * request locale and answers a Chinese reader in English, and it has to
 * duplicate the shell (stylesheet, fonts, theme, message provider) to render
 * anything at all. Worse, enabling its `experimental.globalNotFound` flag
 * stopped `[locale]/not-found.tsx` rendering: the page came back with the
 * correct localized `<title>` and an empty `<body>`. Do not reach for it here.
 */
export default function CatchAllNotFound(): never {
  notFound();
}
