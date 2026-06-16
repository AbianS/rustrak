---
"@rustrak/server": "patch"
---

Fix transaction envelope items being accidentally processed through the error digest pipeline. Performance monitoring transactions are now correctly skipped during error ingestion, matching Sentry Relay's ErrorsProcessor behavior.