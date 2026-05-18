---
name: step-03-decision
description: Display analysis as a compact table, await user decision on which errors to fix
nextStepFix: references/step-04-fix-commit.md
nextStepResolve: references/step-05-resolve.md
---

# Step 3: Decision

## GOAL

Show the full analysis in a single compact table. Get user decision. No changes yet.

## SEQUENCE

### 1. Display Analysis Table

```
PR #{pr_number} — {pr_title}
{count_real} real errors · {count_fp} false positives · {total_analyzed} total

| #  | Author             | Type         | File:line                       | Verdict       | Summary / Action                             |
|----|--------------------|--------------|---------------------------------|---------------|----------------------------------------------|
| 1  | coderabbit 🤖      | logic        | src/routes/ingest.rs:87         | 🔴 REAL       | unwrap() without context on critical path    |
| 2  | coderabbit 🤖      | style        | src/models/event.rs:34          | 🟡 FP         | Idiomatic Rust pattern — project convention  |
| 3  | abians 👤          | security     | src/auth/middleware.rs:112      | 🔴 REAL       | Token exposed in error log                   |
```

Table rules:
- One row per thread in `analysis_results`
- `Author`: `{author_login}` + `🤖` if `is_bot`, `👤` if human
- `File:line`: `{path}:{line}` truncated to 35 chars, or `(general)` if `path` is null
- `Verdict`: `🔴 REAL` or `🟡 FP`
- `Summary / Action`: for REAL → `fix_approach` (max 50 chars); for FP → `fp_explanation` (max 50 chars)

### 2. Decision Menu

**If `count_real = 0`:**
```
No real errors detected. Proceed to resolve all comments on GitHub? [Y/N]
```
Halt. Y → set `approved_fixes = []`, load `{nextStepResolve}`. N → stop.

**If `count_real > 0`:**
```
Which fixes to apply?
  [A] All real errors ({count_real})
  [S] Manual selection — specify indices (e.g.: 1,3)
  [N] None — only resolve comments on GitHub
  [C] Cancel
```
Halt and wait.

- **[A]:** `approved_fixes` = all REAL results → load `{nextStepFix}`
- **[S]:** ask `Which indices? (e.g.: 1,3)` → parse. If a selected index is FP: `⚠️ #{index} is a false positive. Include anyway? [Y/N]`. Set `approved_fixes`. If `approved_fixes` is empty (all rejected): `No fixes selected.` → load `{nextStepResolve}`. Otherwise → load `{nextStepFix}`
- **[N]:** `approved_fixes = []` → load `{nextStepResolve}`
- **[C]:** `Cancelled. No changes have been applied.` → stop
- **Unrecognized input:** re-display menu
