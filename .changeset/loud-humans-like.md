---
"webview-ui": minor
"@rustrak/server": patch
"docs": patch
---

## webview-ui

### Features
- **Skeleton loading states** — issue and event detail routes now show skeleton UI while fetching, eliminating layout shift on navigation
- **Full mobile responsiveness** — projects page, project detail, settings section, event detail, and global header all adapted for small screens
- **Base UI migration** — replaced all Radix UI primitives (shadcn/ui) with Base UI equivalents; corrected data attribute selectors and dropdown widths; rewired form a11y and tabs keyboard orientation
- **Brand icon** — replaced generic Terminal icon with the Rustrak bolt SVG logo icon across the UI

### Bug Fixes
- Fixed stale state on issue dropdown actions by passing `id` directly instead of through closure capture
- Fixed sticky event sidebar not respecting viewport height
- Fixed API docs link in tokens settings page
- Restored correct keyboard orientation for tab components after Base UI migration

## @rustrak/server

### Maintenance
- Updated Rust dependencies: tokio `1.52.1 → 1.52.3`, reqwest `0.13.2 → 0.13.3`, lettre `0.11.21 → 0.11.22`, sentry `0.47.0 → 0.48.2`, utoipa `5.x → 5.5.0`

## docs

### Content
- Added initial Sentry protocol compatibility drift report documenting deviations between Rustrak's ingestion implementation and the official Sentry envelope protocol
