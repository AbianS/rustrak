# Detect and Handle Breaking Changes

Review the diff of what changed for major-version bumps. For each one, research the migration path and handle according to mode. Communicate with the user in `{communication_language}`.

## Identify breaking changes

From the diff, flag any update where the major version changed (e.g. `next@16.x → next@17.x`, `react@19.x → react@20.x`). For Rust deps where semver isn't strictly followed, treat any version change where the first non-zero segment changed as breaking.

## Known breaking-change catalog

Before researching remotely, check this catalog for packages with known, documented migration paths. If a match is found, apply the documented fix directly instead of researching from scratch.

### sqlx 0.8.x → 0.9.x

**Breaking change**: `SqlSafeStr` trait — `sqlx::query_as(&some_string)` no longer compiles because `&String` does not implement `SqlSafeStr`. Only `&'static str` is accepted by default.

**Fix**: Wrap dynamic SQL strings with `sqlx::AssertSqlSafe(&*some_string)` (deref `String` to `&str` first, then wrap). Search for all occurrences of `sqlx::query_as(`, `sqlx::query_scalar(`, `sqlx::query(` in the codebase that pass a `&String` (dereference from local variable). Also check test files.

```rust
// Before (sqlx 0.8)
sqlx::query_as::<_, MyType>(&query)

// After (sqlx 0.9)
sqlx::query_as::<_, MyType>(sqlx::AssertSqlSafe(&*query))
```

### react 18.x → 19.x

React 19 introduces concurrent features, removed deprecated lifecycle methods (`componentWillMount`, etc.), and changed legacy context API. Run `npx react-codemod` transforms.

### tailwindcss 3.x → 4.x

Tailwind v4 is a complete rewrite — no config file, CSS-first configuration, new theme API. Run `npx @tailwindcss/upgrade` which handles the migration.

## Research migration

For each breaking change, research what changed and how to migrate:

1. Look up the package's repository URL (from its `package.json` `repository` field or `Cargo.toml` metadata).
2. Check `{workflow.breaking_change_research_sources}` — visit each URL template with `{owner}` and `{repo}` resolved.
3. For npm packages, also check `https://www.npmjs.com/package/<name>?activeTab=code` and GitHub releases.
4. Understand the key breaking changes and migration steps.

## Interactive mode

For each breaking change, present to the user in `{communication_language}`:

```
Package: next 16.2.6 → 17.0.0 (MAJOR)
Changes: [brief summary of what changed]
Migration: [key migration steps required]
Research sources visited: [list of URLs checked]

Approve update? (y/n/skip-all)
```

- If approved: keep the update, apply any discovered migration steps manually.
- If rejected: revert that specific dep's change using the diff as reference.
- If skip-all: defer all breaking-change updates.

## Headless mode (`headless=true`)

Do NOT ask. Follow `{workflow.headless_breaking_policy}`:
- `"report"`: keep all updates, log breaking changes to the report.
- `"skip"`: revert all breaking-change deps, include them in the report as skipped.