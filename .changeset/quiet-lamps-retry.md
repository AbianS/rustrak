---
"@rustrak/server": patch
---

Hermes and Metro source maps are now symbolicated: maps carrying `x_facebook_sources` are parsed as Hermes instead of being rejected, and original function names are resolved from the Hermes scope data (@roberteggl). The chunk upload flow answers `sentry-cli --wait` correctly: assemble always returns HTTP 200 and carries the state in the body (@roberteggl), and a poll after the assembly job finished is answered from the job rather than from chunk rows the worker already consumed.

SQLite writes survive contention. A digest whose write transaction hits a busy lock retries the whole transaction with backoff instead of dropping the event (@reneleonhardt), and grouping, issue, event and the project counter now commit or roll back together. WAL runs with `synchronous=NORMAL`, which removes one disk flush per commit (@reneleonhardt), while `busy_timeout` stays at 5s so every writer without a retry loop keeps its tolerance.

Also: 18 dependencies updated across the workspace, all pinned exact.
