---
name: sentry-protocol-drift
description: Detect Sentry protocol changes and Rustrak compatibility gaps. Use when the user says 'check sentry compat', 'sentry drift', 'protocol drift', or 'check sentry compatibility'.
---

# sentry-protocol-drift

## Overview

Checks for Sentry protocol changes since the last review and identifies compatibility gaps in Rustrak. Act as a Sentry protocol analyst: fetch recent `getsentry/relay` releases, parse changelogs for wire-level changes, scan key sentry-docs spec pages, check SDK versions, then analyze the Rustrak server codebase to surface concrete gaps with actionable fix suggestions. Produces a dated drift report in `{project-root}/docs/sentry-compat/`.

## Conventions

- Bare paths (e.g. `references/protocol-context.md`) resolve from the skill root.
- `{project-root}`-prefixed paths resolve from the project working directory.

## On Activation

Load available config from `{project-root}/_bmad/config.yaml` and `{project-root}/_bmad/config.user.yaml` if present. Use sensible defaults for anything not configured.

## Workflow

### Step 1: Load State

Read `{project-root}/docs/sentry-compat/.last-check.json`. If the file is missing, this is a first run — review the last 3 Relay releases.

State schema:
```json
{
  "last_relay_version": "26.4.2",
  "last_checked": "2026-05-01"
}
```

### Step 2: Fetch Relay Releases

Fetch recent releases via the GitHub API:
```
https://api.github.com/repos/getsentry/relay/releases?per_page=10
```

Identify releases newer than `last_relay_version` (or the last 3 on first run). Collect the version tag and release body for each.

### Step 3: Extract Protocol-Relevant Changes

Load `references/protocol-context.md` for the taxonomy of what matters vs. what to ignore. For each release body, extract changes that affect server-side compatibility and classify by impact:

- **HIGH** — Breaking: status code changes, removed endpoints, removed item types, auth changes
- **MEDIUM** — New item types the server should handle, new required fields
- **LOW** — Additive: new optional fields, new item types the server can safely ignore

Discard: internal Relay processing, performance improvements, UI/product features, cloud-only paths (OTLP, AI monitoring, Sentry Cloud).

### Step 4: Scan Spec Pages

Fetch these two pages and scan for "new", "changed", or "deprecated" language not already captured in Step 3:
- `https://develop.sentry.dev/sdk/data-model/envelopes/`
- `https://develop.sentry.dev/sdk/data-model/envelope-items/`

### Step 5: Check SDK Versions

Fetch the current latest versions to understand what envelope features are actively being sent in the wild:
- npm: `https://registry.npmjs.org/@sentry/node/latest` → `version` field
- PyPI: `https://pypi.org/pypi/sentry-sdk/json` → `info.version` field

### Step 6: Analyze Rustrak Codebase

Search `{project-root}/apps/server/src/` for evidence of handling each HIGH/MEDIUM finding from Step 3 and each item type from `references/protocol-context.md`. Also verify HTTP status code compliance (413 for oversized envelopes, 429 + Retry-After for rate limiting).

For each gap, identify the affected files and provide a concrete implementation suggestion.

### Step 7: Generate Report

Ensure `{project-root}/docs/sentry-compat/` exists. Write the report to `{project-root}/docs/sentry-compat/YYYY-MM-DD-drift-report.md`:

```markdown
# Sentry Protocol Drift Report — YYYY-MM-DD

## Summary
- Relay versions reviewed: [range or "last 3 releases (first run)"]
- Protocol changes found: N (H high / M medium / L low)
- Rustrak gaps: N

## Protocol Changes
### [version] — [date]
- [change description] — **[HIGH/MEDIUM/LOW]**

## SDK Versions
- @sentry/node: X.Y.Z  |  sentry-sdk (Python): X.Y.Z

## Rustrak Gaps
### [Gap Title] — HIGH/MEDIUM
**Change:** [what changed in Relay/spec]
**Gap:** [what Rustrak doesn't handle or handles incorrectly]
**Files:** `apps/server/src/...`
**Fix:** [concrete suggestion]

## No Action Required
- [additive changes Rustrak can safely ignore with rationale]
```

### Step 8: Update State

Write updated state to `{project-root}/docs/sentry-compat/.last-check.json` with `last_relay_version` set to the latest version fetched and `last_checked` set to today's date.

Present the gap count and report path to the user.
