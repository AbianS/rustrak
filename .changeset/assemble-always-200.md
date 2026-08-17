---
"@rustrak/server": patch
---

Return HTTP 200 with `state: "not_found"` and `missingChunks` from artifact-bundle assemble, matching what sentry-cli `--wait` polls. Missing chunks previously used HTTP 202, which made `--wait` fail or hang.
