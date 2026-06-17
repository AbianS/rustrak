# Run Codemods

Codemods run BEFORE version bumps. Use the discovered manifest (current versions) to decide which codemods to run. The package's current code is still on the old version — codemods transform it to be compatible with the new one.

## Workflow

1. Walk the discovered manifest. For every dep that has a matching `code` in `{workflow.codemod_registry}`, run its registered migration.
2. Run codemods regardless of bump size (patch, minor, or major). Even patch bumps can ship new APIs or deprecate old patterns that a codemod may want to fix.
3. For each match:
   - Resolve `<transform>` and `<path>` placeholders:
     - `<transform>` — research what transforms/codemods are available for this version jump. Look at the package's release notes or changelog. For known tools like `@next/codemod`, check available transforms by running the tool with `--help` or `--list`.
     - `<path>` — the workspace directory(s) where the package is used.
   - Run the resolved command in the appropriate workspace directory.
4. Only after all codemods complete, proceed to resolve and pin (version bumps).

## Fan-out

For 3+ codemods, delegate each to a subagent running in parallel. The parent waits for all to complete. Each subagent receives: the package name, the codemod command, the workspace path, and returns: success/failure + stdout tail.

## Examples

If `next` is in the manifest at 16.2.6:
- Look up available next codemods (`npx @next/codemod@latest --help`)
- Run each relevant transform: `npx @next/codemod@latest <transform> apps/webview-ui`
- Then bump next to latest

If `tailwindcss` is in the manifest:
- Run `npx @tailwindcss/upgrade` in each workspace that uses it.
- Then bump tailwindcss to latest

## Error handling

- If a codemod fails, log the failure as a warning (the project may still work fine without it).
- If a codemod command contains `<transform>` but no transforms are available, skip it.
- If a codemod doesn't exist yet for the new version, skip and note it in the report.