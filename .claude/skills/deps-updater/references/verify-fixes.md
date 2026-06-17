# Verify

Run the project's verification suite to confirm nothing broke. Communicate with the user in `{communication_language}`.

## Detection

Determine the project's commands. Heuristics:
- **typecheck:** Look for `tsc --noEmit`, `tsc -b`, or a `typecheck` script in root `package.json`.
- **lint:** Look for a `lint` script, `biome check`, `eslint`, or `ruff` invocation.
- **build:** Look for a `build` script in root `package.json` (Turborepo).
- **test:** Look for a `test` script, `vitest`, `cargo test`, or `pnpm test`.

If `{workflow.test_command}`, `{workflow.typecheck_command}`, `{workflow.build_command}`, or `{workflow.lint_command}` are non-empty, use them instead of auto-detecting.

## Order

Run in this order (fail early):
1. Typecheck — catches type incompatibilities from new API surfaces
2. Lint — catches formatting/style regressions from codemods
3. Build — catches compilation failures
4. Test — catches runtime regressions

For monorepos, run at root via the workspace command (`pnpm -r`, `turbo run`, `cargo test --workspace`).

## On failure

- Report which command failed and what the error was.
- In **interactive** mode: ask the user whether to fix, roll back, or ignore.
- In **headless** mode: set status to `"blocked"` and include the failure details.

Offer to fix: if a typecheck or lint failure has an obvious automated fix (e.g. `biome check --apply`, `tsc --noEmit` issues from new types), run it and re-verify before reporting failure.