---
"@rustrak/server": minor
"webview-ui": minor
"@rustrak/client": patch
"@rustrak/mcp": patch
"docs": patch
---

Add storage usage tracking and data retention.

The server now reports storage usage and supports configurable data retention, including manual storage cleanup and source-map garbage collection. A new storage settings page in webview-ui surfaces usage and cleanup controls. The TypeScript client and MCP package gain a storage resource/tool for programmatic access.

Fixes:
- SQLite: enable WAL mode and use BEGIN IMMEDIATE for digest writes to prevent dropped events under concurrent writes (#131, #141)
- Support clipboard copying over HTTP, with improved fallback positioning (@WahidinAji, #146)
- Correct local PostgreSQL development setup instructions (@WahidinAji, #147)
