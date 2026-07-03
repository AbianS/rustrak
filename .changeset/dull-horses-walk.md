---
"@rustrak/server": "patch"
"webview-ui": "patch"
"@rustrak/client": "patch"
"docs": "patch"
---

## Project Platform Auto-Detection

Server automatically detects project platform from ingested events and exposes a `platform` field. The web UI renders platform-specific icons using platformicons. Client package now exposes `project.platform` in responses.

## Project Overview & Releases

New project overview page with session trend charts and health score cards. New releases section with release environment cards and release list. Server adds releases and enhanced sessions API endpoints. Client adds releases and sessions resources.

## Sentry-Compatible UI Improvements

Stack trace rendering now matches Sentry's behavior with in-app/system frame grouping, platform-adaptive formatting, and threads section. Breadcrumbs display with expand toggle, category icons, and color coding.

## Server Fixes

Oversized events are now intelligently trimmed instead of being rejected outright. Source map rewriting also applies to thread frames, not just exception stacktraces.
