---
"@rustrak/server": "minor"
"webview-ui": "minor"
"@rustrak/client": "patch"
"@rustrak/mcp": "patch"
"docs": "patch"
---

- New Sentry-compatible issues model with status and priority lifecycle management, bulk operations (list stats, copy-as, packages context), and social features (share, bookmark, assign, snooze)
- Issues web UI: new issue detail pages, event navigation with breadcrumbs, activity timeline, trend sparklines, collapsible sidebar
- Token delete confirmation dialog in webview-ui settings
- Agent-rusty now has access to the full getsentry/sentry monolith source for deeper Sentry compatibility analysis
- Fixed is_resolved and is_muted shim logic to not interfere with muted/resolved issues
- Fixed userReportSchema to accept empty-string email
- Fixed 3 Sentry-compat divergences identified against the monolith source
- Performance: list_stats now projects only `data->user` instead of full event blob
- Dependencies updated to latest exact versions
