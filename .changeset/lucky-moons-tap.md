---
"@rustrak/server": patch
---

Rebuild the project overview as a bento dashboard, backed by two new project-level stats endpoints (`GET /api/projects/{id}/events/stats` for error volume bucketed by severity, and `GET /api/projects/{id}/stats/summary` for events, new issues and open issues against the preceding window). The overview gains a period filter held in the URL, per-tile Suspense streaming, and a chart palette validated for contrast and colorblind separation.

Releases now render as a paginated table matching Issues, Logs, Performance and Agents. `GET /api/projects/{id}/sessions/stats` accepts `page`/`per_page` and returns an `OffsetPaginatedResponse<ReleaseHealthRow>` instead of a bare array; `sessions.stats()` in `@rustrak/client` takes an options object instead of positional arguments, and `releaseHealthSchema` and the `ReleaseHealth` array type are removed.

`@rustrak/mcp` exposes the new stats endpoints as `get_error_volume` and `get_project_stats`.
