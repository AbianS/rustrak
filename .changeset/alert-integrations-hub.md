---
"@rustrak/client": patch
"@rustrak/server": patch
"@rustrak/mcp": patch
"webview-ui": patch
"docs": patch
---

feat(alerts): two-tier integrations with global credentials and per-rule routing override

- Add alert integrations hub UI with collapsible section layout
- Add two-tier alert routing: global channel credentials + per-rule override
- Redesign alert rule form dialog
- Remove legacy `channel_ids` field from alert rules
- Add `alert-integrations` and `alert-channels` resources to client package
- Fix source maps chunk upload to accept non-SHA1 multipart field names
- Fix project event counts not decrementing when an issue is deleted
- Regenerate OpenAPI spec with updated alert models
