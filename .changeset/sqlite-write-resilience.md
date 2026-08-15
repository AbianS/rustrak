---
"@rustrak/server": minor
---

Retry SQLite digest writes on busy errors (app-level writer slot) and shorten write-lock waits (`synchronous(NORMAL)`, 500ms busy timeout).
