/**
 * Real GitHub sponsors, read at build time.
 *
 * The Sponsors data is not in the REST API and the GraphQL one needs a token,
 * which a static site has nowhere safe to keep. `sponsors_partial` is the
 * fragment GitHub's own sponsors page loads its avatar wall from: public, no
 * auth, and it returns exactly the people who are actually sponsoring right
 * now. The trade is that it is HTML rather than JSON, so everything here is
 * written to fail closed — an unrecognised response yields no sponsors, and no
 * sponsors means the section does not render at all.
 *
 * `apps/docs` is `output: 'export'`, so this runs during `next build`. The
 * wall therefore refreshes on deploy, not on visit. Fetching it in the browser
 * instead is not an option: github.com sends no CORS headers for this path.
 */

export interface Sponsor {
  login: string;
  avatar: string;
  isOrganization: boolean;
}

const SPONSORS_URL =
  'https://github.com/sponsors/AbianS/sponsors_partial?filter=all';

/**
 * One anchor per sponsor: the hovercard type tells us whether it is a person
 * or an org, the href carries the login and the nested img the avatar.
 */
const ENTRY =
  /<a[^>]*data-hovercard-type="(user|organization)"[^>]*href="\/([^"/]+)"[^>]*>\s*<img[^>]*src="([^"]+)"/g;

/**
 * Attribute values arrive HTML-escaped, so an avatar URL reads
 * `?s=60&amp;v=4`. Handed straight to `src` that becomes a query parameter
 * literally named `amp;v`, which happens to work today only because the
 * parameter it mangles is optional.
 */
function decode(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function fetchSponsors(): Promise<Sponsor[]> {
  try {
    const response = await fetch(SPONSORS_URL, {
      headers: { Accept: 'text/html' },
      // A slow or unreachable GitHub must never hold up a build.
      signal: AbortSignal.timeout(8000),
      cache: 'force-cache',
    });
    if (!response.ok) return [];

    const html = await response.text();
    const sponsors: Sponsor[] = [];
    const seen = new Set<string>();

    for (const [, type, login, avatar] of html.matchAll(ENTRY)) {
      if (!login || !avatar || seen.has(login)) continue;
      seen.add(login);
      sponsors.push({
        login,
        // The partial asks for 30px; ask for one that survives a retina card.
        avatar: decode(avatar).replace(/([?&]s=)\d+/, '$1160'),
        isOrganization: type === 'organization',
      });
    }

    return sponsors;
  } catch {
    // Offline builds, a rename, a markup change: all of them mean "no wall".
    return [];
  }
}
