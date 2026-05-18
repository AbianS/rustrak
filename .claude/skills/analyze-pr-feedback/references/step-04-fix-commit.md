---
name: step-04-fix-commit
description: Apply approved fixes, adaptive lint/test pipeline by file type, confirm and commit+push to PR branch
nextStep: references/step-05-resolve.md
---

# Step 4: Fix + Commit

## GOAL

Apply only `approved_fixes`. Lint and tests adapted to the touched files. Confirm commit message. Commit + push to `pr_head_branch`. No GitHub API calls.

## CONSTRAINTS

- Fix ONLY items in `approved_fixes` — no opportunistic refactoring
- NEVER use `--no-verify`
- NEVER push to `main`
- NEVER open a new PR

## SEQUENCE

### 1. Apply Each Fix

For each item in `approved_fixes`:

**a.** Read `{path}` if not already in memory.

**b.** Apply the change with the `Edit` tool as described in `fix_approach`. Preserve existing code style. Fix ONLY what the comment addresses.

**c.** If the fix is non-trivial (schema change, new module, migration):
```
⚠️ Fix #{index} is complex: {description}. Proceed? [Y/N]
```
Halt. N → add to `skipped_fixes` with reason, continue with the next.

Mark `fix_applied = true` for applied items.

### 2. Lint and Test Pipeline

Determine which pipelines to run based on the paths of modified files:

#### Rust files (`apps/server/`)

```bash
cd apps/server && cargo fmt
```
```bash
cd apps/server && cargo clippy -- -D warnings
```
**If clippy reports errors:** display them and fix before continuing.

```bash
cd apps/server && cargo test
```
**If tests fail:** display the failure. If pre-existing (not caused by the fixes): ask `Pre-existing failure unrelated to these changes. Continue? [Y/N]`.

#### TypeScript — Client (`packages/client/`)

```bash
pnpm --filter @rustrak/client test
```
**If tests fail:** display the failure. If pre-existing: ask the same question as Rust.

#### Next.js — WebView UI (`apps/webview-ui/`)

```bash
pnpm --filter webview-ui build
```
No unit tests — display `ℹ️ Changes in webview-ui — manual validation recommended.`

#### Changes across multiple zones

Run each affected zone's pipeline in order: server → client → webview-ui.

### 3. Show Diff and Propose Commit

Run `git diff --stat` and `git status --short`. Display:

```
Modified files:
{git diff --stat output}

Fixes applied: {count}
{for each fix_applied: "  [{index}] {path}:{line} — {comment_claim}"}
{if skipped_fixes: "Skipped: {count} — {reasons}"}

Proposed commit:
fix({scope}): address PR #{pr_number} review feedback

{2-3 lines describing what was fixed and why}

[Y] Confirm  [E] Edit message  [C] Cancel
```

`scope` = most affected module in kebab-case. If spanning unrelated zones → `review`.

Halt. C → `Changes are in your working tree. No commit was made.` → stop.

### 4. Stage, Commit, Push

Stage only the files modified by `approved_fixes`:
```bash
git add {paths from approved_fixes that were actually modified}
```

Verify with `git status` — if unrelated files appear, `git restore --staged` them.

```bash
git commit -m "$(cat <<'EOF'
{commit_message}
EOF
)"
```

**If commit fails (hook):** display the error, fix it, re-stage, create a new commit — never use `--no-verify`.

Store `commit_sha`. Display: `✅ Commit: {commit_sha}`

```bash
git push origin {pr_head_branch}
```

**If push is rejected:** ask `⚠️ Push was rejected. Force push? [Y/N]` — NEVER force without explicit confirmation.

- **[Y]:** `git push --force-with-lease origin {pr_head_branch}` → success: `✅ Force pushed: {pr_head_branch}` → failure: display error → stop.
- **[N]:** `Changes are committed locally. Push cancelled.` → stop.

Display: `✅ Pushed to {pr_head_branch}.`

Load and execute `{nextStep}`.
