---
"@rustrak/server": patch
"webview-ui": patch
"@rustrak/client": patch
"@rustrak/mcp": patch
"docs": patch
---

Replace cursor-based pagination with offset-based pagination for the transactions API. Fix MCP package declaration output to ensure proper type exports (@jamilahmadzai). Update quinn-proto dependency and address various review feedback across the server, client, and UI packages.