---
"@rustrak/server": patch
"webview-ui": patch
---

Bug fixes for ingest, auth, Slack alerts, and UI stability

- fix(ingest): raise payload size limit to 100MB
- fix(digest): delete orphaned temp files on processing error
- fix(projects): retry slug INSERT on unique collision instead of 409
- fix(auth): propagate DB errors from ApiAuth instead of masking as 401; accept Bearer tokens on management API endpoints
- fix(slack): guard token redaction, reject whitespace-only channel, prevent silent data loss on bot_token channel edit
- fix(alerts): use project id instead of slug in alert issue URL
- fix(docker): build server with postgres feature in dev compose
- fix(ui): remove theme-dependent syntax highlighter to fix stack trace hydration mismatch
