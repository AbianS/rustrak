---
title: 'Update available notice'
type: 'feature'
created: '2026-07-21'
status: 'done'
review_loop_iteration: 0
baseline_commit: '928cf509dec7ea12362561208e14dfefd5616583'
context: []
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** A self-hosted Rustrak instance gives its operator no signal that a newer release exists. Finding out means going to GitHub releases or the docs changelog by hand.

**Approach:** The docs site publishes a static `versions.json` generated from the changelog MDX frontmatter that is already maintained per release. That file is Rustrak's version feed. The dashboard fetches it server-side, compares against the running server version, and shows a dismissible floating pill that expands on hover into the release description and a link to that release's changelog entry.

## Boundaries & Constraints

**Always:**
- The version check runs server-side only. The browser never fetches the feed.
- `RUSTRAK_VERSION_CHECK_ENABLED=false` disables it. That is the only environment variable this feature introduces, it is server-side only (no `NEXT_PUBLIC_` prefix), and the feed URL is a hardcoded constant.
- Any failure (network, timeout, malformed JSON, non-200) results in nothing rendered and no user-visible error. The check must never block or break page render.
- The fetch is cached with `next: { revalidate: 3600 }` and bounded by `AbortSignal.timeout(3000)`, so it costs one outbound request per instance per hour regardless of how many people use the dashboard.
- `versions.json` is generated at docs build time, is gitignored, and is never committed.
- The notice is `fixed`. It consumes no layout space and must not alter the header or any shared layout file beyond one line in `(main)/layout.tsx`.

**Ask First:**
- Adding a test runner to `apps/webview-ui` (it currently has none).
- Any change to `.github/workflows/`.
- Publishing the version feed from anywhere other than the docs site.

**Never:**
- No call to the GitHub Releases API. The repo's tag namespace mixes product releases (`v0.12.1`) with per-package changeset tags (`docs@0.1.43`, `@rustrak/client@0.3.15`), so `/releases/latest` is not reliably the product release.
- No new server-side (Rust) code. `/health/version` is used as-is.
- No animation library. The morph is an SVG filter plus CSS transitions.
- No telemetry, no instance ID, no analytics on the outbound request.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Update available | server `0.12.1`, feed latest `0.13.0` | Collapsed pill: "0.13.0 available" | N/A |
| Hover or focus | pill collapsed | Expands into a panel showing `0.12.1 → 0.13.0`, the release description clamped to 2 lines, and a button linking to that release's changelog anchor | N/A |
| Release has no description | feed entry `description` absent or empty | Panel renders without the description line, layout stays intact | N/A |
| Up to date | server `0.12.1`, feed latest `0.12.1` | Nothing rendered | N/A |
| Ahead of feed | server `0.13.0`, feed latest `0.12.1` (dev build) | Nothing rendered | N/A |
| Check disabled | `RUSTRAK_VERSION_CHECK_ENABLED=false` | Nothing rendered, no outbound fetch at all | N/A |
| Feed unreachable | fetch throws, times out, or returns non-200 | Nothing rendered | Caught, returns null, never throws |
| Malformed feed | JSON missing `versions`, or unparseable version strings | Nothing rendered | Caught, returns null |
| Server unreachable | `/health/version` fails | Compares against `APP_VERSION` instead | Silent fallback |
| Dismissed current latest | localStorage holds `0.13.0`, feed latest `0.13.0` | Nothing rendered | N/A |
| Dismissed, newer ships | localStorage holds `0.13.0`, feed latest `0.14.0` | Pill shows again | N/A |
| Reduced motion | `prefers-reduced-motion: reduce` | Idle glow and sheen do not run | N/A |

</frozen-after-approval>

## Code Map

- `apps/docs/content/changelog/*.mdx` -- source of truth, frontmatter: `version` (`v0.12.1`), `title`, `description`, `date`, `tags`
- `apps/docs/src/lib/changelog.ts` -- `getReleases()`, sorts date desc then slug desc; slug is filename minus `.mdx`
- `apps/docs/src/app/changelog/page.tsx` -- renders the release timeline
- `apps/docs/package.json` -- `gray-matter` is already a dependency
- `.github/workflows/docker-publish.yml:291` -- `deploy-docs` job, precedent for generated files in `apps/docs/public/`
- `apps/webview-ui/src/actions/server.ts` -- `getServerVersion()`, existing Server Action wrapping `/health/version`
- `apps/webview-ui/src/lib/constants.ts` -- `APP_VERSION` from package.json
- `apps/webview-ui/src/app/(main)/layout.tsx` -- auth guard, renders `<Header />` then `<main>`

## Tasks & Acceptance

**Execution:**
- [x] `apps/docs/scripts/generate-versions.mjs` -- new script: read `content/changelog/*.mdx` with `gray-matter`, sort newest first by semver (major/minor/patch desc, then date desc, then slug desc as tie-breakers, unparseable versions last), write `public/versions.json` as `{ latest, versions: [{ version, title, description, date, url }] }`. Strip the leading `v` from `version` so it matches `/health/version` output. `url` is `https://rustrak.github.io/rustrak/changelog#<slug>`. -- the feed the notice consumes
- [x] `apps/docs/package.json` -- change `build` to `node scripts/generate-versions.mjs && next build`. Do not use a `prebuild` lifecycle hook. -- pnpm's `enable-pre-post-scripts` default is not guaranteed; a silent skip in CI would ship a stale or missing feed
- [x] `apps/docs/src/app/changelog/page.tsx` -- add `id={release.slug}` and a `scroll-mt-*` offset to each release entry wrapper -- makes the `url` in the feed land on the right entry
- [x] `.gitignore` -- add `apps/docs/public/versions.json` -- generated artifact, same treatment as `openapi.json` in docs
- [x] `apps/webview-ui/src/lib/version.ts` -- new: `normalizeVersion(v)` strips a leading `v`; `compareVersions(a, b)` numeric major/minor/patch compare returning -1/0/1, and returns 0 when either side is unparseable -- unknown must never read as "update available"
- [x] `apps/webview-ui/src/actions/version-check.ts` -- new Server Action `getUpdateInfo()`: bail early when disabled; resolve current version from `getServerVersion()` falling back to `APP_VERSION`; fetch the feed; select the highest entry newer than current via `compareVersions` rather than taking the first; return `{ current, latest, description, url } | null`. Wrap everything in try/catch returning null. -- follows the existing `getServerVersion()` pattern in `actions/server.ts`. The feed is a public artifact served from GitHub Pages, so the dashboard does not trust its ordering even though the generator now sorts by semver
- [x] `apps/webview-ui/src/components/update-banner.tsx` -- new Client Component: a `fixed` pill that expands on hover or focus. Reads and writes `localStorage['rustrak:update-dismissed']`, renders nothing until mounted, hides when the stored value equals `latest`. Carries an `sr-only` `role="status"` announcement, and the `prefers-reduced-motion` rule covers the entry animation as well as the idle glow and sheen. -- dismissal keyed to the version so a newer release re-surfaces it; the pill only reads as an update visually, so the live region is the only signal a screen reader user gets
- [x] `apps/webview-ui/src/app/(main)/layout.tsx` -- render `<UpdateBanner />` from a dedicated async component behind `<Suspense fallback={null}>` -- one notice for the whole authenticated app, and awaiting the feed inline would put an optional external fetch on the render path of every authenticated page
- [x] `apps/docs/content/configuration/environment.mdx` -- document `RUSTRAK_VERSION_CHECK_ENABLED` in the Dashboard table with the privacy rationale -- self-hosted operators need a documented way to turn off outbound calls. Not `apps/webview-ui/.env.example`: that file is gitignored by the Next.js default `.env*` rule, so anything written there never reaches the repo

**Acceptance Criteria:**
- Given a docs build, when it completes, then `apps/docs/out/versions.json` exists, parses, and its `versions[0].version` is the highest version across the changelog entries with no `v` prefix.
- Given the notice is rendered, when the changelog button is clicked, then the docs changelog opens scrolled to the entry for that release.
- Given `RUSTRAK_VERSION_CHECK_ENABLED=false`, when any authenticated page renders, then no outbound request to the feed is made.
- Given the notice was dismissed, when the user navigates to another page or reloads, then it stays hidden for that version.
- Given the feed host is unreachable, when an authenticated page renders, then the page renders normally within its usual time and no notice or error appears.
- Given a changelog entry whose date is later than a higher-numbered release, when the feed is generated, then that entry is not `versions[0]` and the notice does not advertise it as the latest.
- Given `prefers-reduced-motion: reduce`, when the notice appears, then it does so without translation, scale or overshoot, and the glow and sheen do not animate.

## Spec Change Log

- **2026-07-21, full-width bar replaced by a floating pill.** The approved design was a dismissible bar across the top. It was rejected over several review rounds: the lime-tinted bar read as noise, and being `sticky` it consumed vertical space on every page. The replacement is a `fixed` pill that expands on hover. The frozen Intent, Boundaries and I/O matrix were rewritten with the human's authorisation so the spec describes what was actually built. **KEEP:** the data path never changed and is validated. Static `versions.json` generated from changelog frontmatter, per-release anchors in the docs changelog, server-side fetch with a 1h revalidate, silent failure to `null`. Do not re-derive the feed.
- **2026-07-21, panel content narrowed to version jump plus description.** Intermediate designs listed every missing release, then led with the release title. Settled on `current → latest` in monospace plus the frontmatter `description` clamped to two lines. This dropped `title` and `count` from `UpdateInfo`. `title` stays in the feed because `versions.json` is a public artifact other consumers may use.
- **2026-07-21, feed URL hardcoded.** An earlier draft also had `RUSTRAK_VERSIONS_URL` to override the endpoint. There was no requirement behind it, so it was removed and the URL is now a constant. `RUSTRAK_VERSION_CHECK_ENABLED` was kept because a self-hosted install may be required to make no outbound requests. Side effect: there is no supported way to point the check at a fixture, so verifying the live path needs either a real newer release or a temporary edit to the constant.
- **2026-07-21, feed ordered by semver instead of by date.** PR #207 review flagged that `newer[0]` trusted the feed's order. The original `date desc, slug desc` sort happened to be right only because changelog filenames carry zero-padded numeric prefixes that correlate with release order, and same-day releases are common enough that the tie-breaker runs constantly. It breaks in two reachable cases: a backported patch dated after the minor that supersedes it, and release 100 onward, where a three-digit prefix sorts below `99-` lexicographically. The generator now sorts by semver, and `getUpdateInfo()` independently selects the maximum. Both layers are deliberate: the feed is a public artifact and the dashboard should not depend on a remote input's ordering.
- **2026-07-21, update check moved off the layout's render path.** The same review flagged that awaiting `getUpdateInfo()` in `(main)/layout.tsx` blocked `<Header/>` and `<main>` for up to the 3s fetch timeout on a cache miss, for a decorative banner. It now streams behind `<Suspense fallback={null}>`. The "renders normally within its usual time" acceptance criterion was only nominally met before this.
- **2026-07-21, prerelease precedence declined.** The review asked for full SemVer prerelease handling, since `parse()` truncates `0.13.0-rc.1` to `0.13.0`. Declined: no Rustrak release has ever carried a prerelease version, there is no `.changeset/pre.json`, and the feed is generated from changelog frontmatter, so the `latest` side is always stable. The failure mode would also be a missing notice rather than a wrong one, which matches the deliberate conservative design of `compareVersions`. Revisit if Rustrak ever ships an RC.
- **2026-07-21, known unfixed behaviour, accepted by the human.** Returning to the tab after opening the changelog leaves the panel expanded. The browser restores focus to the clicked link, which sits inside the panel, and the component's `onFocus` handler reopens it. Collapsing in the link's `onClick` does not help for that same reason. A `useEffect` listening to `window.blur` and `visibilitychange` did fix it, but was removed because the human prefers fewer effects and accepted the behaviour as-is.

## Design Notes

**Why a static feed and not the GitHub Releases API.** The repo's tags mix product releases with per-package changeset tags (`docs@0.1.43`, `@rustrak/server@0.11.1`). `/releases/latest` returns the right thing today only because of publish ordering, and would silently return a docs release if one were published after a product release. The changelog frontmatter is curated per release and is the honest source.

**Why the slug is the anchor** rather than something derived like `v0-12-1`: the generator is `.mjs` and the changelog page is `.tsx`, so they cannot share a helper. Using `slug` verbatim on both sides means there is no transformation rule that can drift between them.

**The morph.** Two rounded divs, a narrow pill above a full-width panel, both under one `feGaussianBlur` plus `feColorMatrix` alpha-contrast plus `feComposite atop` filter, so they fuse into a single shape with a liquid neck as the panel grows. Only the panel's height animates; the pill's width is measured from its content and never changes. Three things are easy to get wrong, and each was a real bug during implementation:

- The filter id must be sanitised. `useId()` returns ids containing `:`, which makes `url(#:r0:)` invalid CSS and silently disables the filter, so nothing fuses.
- Measurement must not run on a render that returns `null`. If it does, the refs are null, the pill collapses to its minimum width and the transition string resolves to `0s`, so the panel snaps open with no animation.
- The filtered container needs `transform: translateZ(0)` and `contain: layout style`, otherwise the browser re-rasterises the filtered layer when the height transition ends and the shape visibly jumps.

The spring is a CSS `linear()` easing sampled from a bounce-0.25 spring, held in the `SPRING` constant. No animation dependency is needed.

**Feed shape**, newest first:

```json
{
  "latest": "0.12.1",
  "versions": [
    {
      "version": "0.12.1",
      "title": "Email Integration Test Fix",
      "description": "The \"Send a test\" action on email integrations now uses the recipients you type instead of dropping them",
      "date": "2026-07-20",
      "url": "https://rustrak.github.io/rustrak/changelog#38-v0-12-1-email-integration-test-fix"
    }
  ]
}
```

The full list ships (38 entries, roughly 8KB) rather than a filtered slice, because a static file cannot take the current version as a parameter. The hourly server-side cache makes the size irrelevant.

## Verification

**Commands:**
- `pnpm build:docs` -- expected: succeeds, `apps/docs/out/versions.json` exists and parses, and every `url` anchor in it resolves to an `id` in `apps/docs/out/changelog.html`
- `pnpm --filter webview-ui build` -- expected: succeeds, no type errors
- `npx tsc --noEmit` in `apps/webview-ui` -- expected: clean
- `npx biome check` on the changed files -- expected: clean. Pre-existing `noImportantStyles` warnings in `apps/docs/src/app/globals.css` are unrelated to this work.

**Verified:** all of the above pass. The feed generates 38 entries with keys `version, title, description, date, url`, and all 38 anchors resolve in the exported changelog.

**Not verified:** the live path has never been executed. `getUpdateInfo()` fetching the real feed, the one-hour cache, the `APP_VERSION` fallback when the server is unreachable, and `RUSTRAK_VERSION_CHECK_ENABLED=false` were all reasoned about but never run, because exercising them needs a running server, a database and a session. The component was reviewed visually against a temporary fixture on the login page, which was reverted. Closing this needs a full local stack and a release newer than the running one.
