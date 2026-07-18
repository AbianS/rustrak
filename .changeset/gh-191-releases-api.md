---
"@rustrak/server": minor
"@rustrak/client": patch
"@rustrak/mcp": patch
"docs": patch
---

## Sentry Releases API

Server implements `POST`/`PUT .../releases/...`, the endpoints `sentry-cli` and the Sentry JS bundler plugins (Next.js, SvelteKit, Nuxt, Remix) call on every build to create and finalize a release. Previously these 404'd, showing up in every build log for most self-hosted JS users. Adds a `releases` table (`project_id` + `version`, unique) backing the new endpoints.

Regression clearing for issues resolved "in the next release" now compares real release creation dates instead of a string-inequality check, and runs automatically whenever a release is created — matching Sentry's own behavior of clearing pending resolutions on release creation.

## Removed: `POST /api/projects/{id}/deploys`

This project-invented endpoint (and `@rustrak/client`'s `createDeploy` / `@rustrak/mcp`'s `record_deploy`) is removed. It existed only as a manual workaround to trigger the regression-clearing logic before release creation could do it automatically — creating a release now has the same effect, matching real Sentry (which has no such endpoint either; Sentry's own Deploy object is unrelated deploy-tracking metadata, not a regression-clearing trigger).
