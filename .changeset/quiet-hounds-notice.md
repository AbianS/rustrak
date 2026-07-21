---
"@rustrak/server": patch
---

The dashboard now tells you when a newer Rustrak release is available. A dismissible pill appears at the top of authenticated pages, expanding on hover into the version jump and a link to that release's changelog entry. The check reads a static feed published by the docs site, runs server-side with an hourly cache, and can be turned off entirely with `RUSTRAK_VERSION_CHECK_ENABLED=false`.
