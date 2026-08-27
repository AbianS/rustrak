---
"@rustrak/server": "patch"
---

Fix event grouping when an SDK sends an empty `fingerprint` array. sentry-ruby always sends `"fingerprint": []`, and a fingerprint whose elements Relay drops (null, arrays, objects) also ends up empty. Both cases produced an empty grouping key, collapsing every error in the project into a single issue. An empty fingerprint now means "no custom fingerprint" and falls back to default grouping, matching Sentry.
