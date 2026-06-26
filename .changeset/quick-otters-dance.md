---
"@rustrak/server": "patch"
"@rustrak/client": "patch"
"@rustrak/mcp": "patch"
"webview-ui": "patch"
"docs": "patch"
---

Storage cleanup now supports scoping to specific data types (events, transactions, logs, sessions). The server endpoint accepts optional data-type filter parameters, the MCP tools include `--events`, `--transactions`, `--logs`, and `--sessions` flags, the client forwards the filter options, and the WebView UI provides a data-type selection interface. Also fixes the cleanup success toast to correctly report when no issues were found.
