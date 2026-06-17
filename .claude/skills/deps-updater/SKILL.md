---
name: deps-updater
description: Updates dependencies to exact latest versions across the monorepo. Use when user says 'update dependencies', 'upgrade deps', or 'run dep update'.
---

# deps-updater

## Overview

Scans every `package.json` and `Cargo.toml` in the workspace, resolves latest versions, pins them as exact, runs available codemods, then verifies nothing broke. Detects breaking changes and researches fixes, asking for user approval in interactive mode. Supports headless mode and scope narrowing (`--workspace`, `--packages`, `--skip-packages`). Act as a senior dependency maintenance engineer — minimize drift while protecting stability.

## Conventions

- Bare paths (e.g. `references/discover-deps.md`) resolve from the skill root.
- `{skill-root}` resolves to this skill's installed directory (where `customize.toml` lives).
- `{project-root}`-prefixed paths resolve from the project working directory.
- `{skill-name}` resolves to the skill directory's basename.

## On Activation

### Step 1: Resolve the Workflow Block

Run: `python3 {project-root}/_bmad/scripts/resolve_customization.py --skill {skill-root} --key workflow`

If the script fails, resolve the `workflow` block yourself by reading these three files in base → team → user order and applying structural merge rules: `{skill-root}/customize.toml`, `{project-root}/_bmad/custom/{skill-name}.toml`, `{project-root}/_bmad/custom/{skill-name}.user.toml`. Scalars override, tables deep-merge, arrays of tables keyed by `code`/`id` replace matching entries and append new ones, all other arrays append.

### Step 2: Execute Prepend Steps

Execute each entry in `{workflow.activation_steps_prepend}` in order before proceeding.

### Step 3: Load Persistent Facts

Treat every entry in `{workflow.persistent_facts}` as foundational context for the whole run. Entries prefixed `file:` are paths or globs — load the referenced contents as facts. All other entries are facts verbatim.

### Step 4: Execute Append Steps

Execute each entry in `{workflow.activation_steps_append}` in order before entering the workflow's first stage.

### Step 5: Detect Headless

If `--headless` or `-H` was passed, set `headless=true` for the run. Read `{workflow.headless_breaking_policy}` to determine breaking-change treatment.

### Step 6: Parse Scope

Parse `--workspace`, `--packages`, and `--skip-packages` from invocation args. Fall back to `{workflow.workspace_scope}`, `{workflow.package_scope}`, `{workflow.skip_packages}` if not provided. Empty means "all".

## Workflow

### Pre-flight

Before any file writes, verify:
- Git is available and working tree is clean (warn if dirty, block in headless mode).
- Required tools are installed: `ncu` (npm-check-updates) and `cargo-upgrade` (cargo-edit). If missing, install them.
- Network is reachable to package registries (npm registry, crates.io).
- The project has the expected file structure (root `package.json`, `Cargo.toml` for Rust workspaces).

In interactive mode, present a summary of what will be checked and ask to proceed. In headless mode, abort early if any pre-flight check fails.

### Stage 1: Discover Dependencies

Load `references/discover-deps.md` and execute. Applies scope filters to the manifest. Produces a filtered manifest of external deps across JS and Rust workspaces.

Progression: proceed when a complete, filtered manifest has been produced.

**Soft-gate (interactive only):** Present the scope and number of packages to update. "Ready to update {N} packages across {M} workspaces to latest? Any packages to skip or workspaces to exclude?" Let the user adjust scope before proceeding to file mutations.

### Stage 2: Run Codemods

Load `references/run-codemods.md` and execute. For each dep in the manifest with a matching entry in `{workflow.codemod_registry}`, run the registered migration. Codemods run BEFORE version bumps so they can transform code while the old version is still installed.

Progression: proceed when all applicable codemods have been attempted (failures are warnings, not blockers).

### Stage 3: Resolve and Pin

Load `references/resolve-and-pin.md` and execute. Updates all package.json and Cargo.toml to latest exact versions. Save a diff of what changed before proceeding.

Progression: proceed when all deps are at latest exact versions (or breaking changes were deferred to user approval).

### Stage 4: Verify

Load `references/verify-fixes.md` and execute. Run typecheck, lint, build, and tests across the workspace.

Progression: proceed on all-clear. On failures, offer to roll back or fix.

### Stage 5: Handle Breaking Changes

Load `references/detect-breaking.md` and execute. Identify major-version bumps, research migration paths, and in interactive mode ask the user to approve each one before finalizing.

Progression: all breaking changes resolved (approved, reverted, or skipped per headless policy).

### Stage 6: Report

Load `references/report.md` and execute. Summarize what changed, what was verified, and any unresolved issues. In headless mode, this is the final output. In interactive mode, present and ask if the user is satisfied.

## Headless Output

When `headless=true`, emit JSON at the end:

```json
{
  "status": "complete",
  "scope": { "workspaces": ["apps/webview-ui"], "packages": [], "skipped": [] },
  "updated_packages": 5,
  "breaking_changes": ["next@17.0.0", "react@20.0.0"],
  "unresolved": [],
  "verification": "all-passed"
}
```

On verification failure: `"status": "blocked"` with a `"reason"` field.

## Rollback

If verification fails in Stage 4, the user may ask to roll back. Restore from git: `git checkout -- <paths>` for affected files. The diff saved in Stage 3 is the source of truth for what changed.
