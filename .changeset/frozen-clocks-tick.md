---
"@rustrak/server": patch
"webview-ui": patch
"@rustrak/client": patch
"@rustrak/mcp": patch
"docs": patch
---

Release health period selector: the period parameter is now optional and configurable from the UI via a dropdown (24h, 48h, 7d). Previously the stats endpoint defaulted to 24h with no override. Also updates 35 JS and 11 Rust dependencies, removes 8 unused webview-ui packages, and fixes the Docker Rust base image version.
