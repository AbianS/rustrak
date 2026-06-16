# Discover Dependencies

Build a complete manifest of every external dependency across the workspace. Exclude `node_modules`, `.git`, `target`, and any build output directories. Apply scope filters from the workflow config.

## What to collect

For **JavaScript/TypeScript** (all `package.json` files in the workspace):
- Package name, current version spec (from `dependencies` and `devDependencies`)
- Whether it's a workspace-internal dependency (check if it matches a workspace path from the root `package.json` `workspaces` field) — skip internals
- Which workspace it was found in (path to the `package.json`)

For **Rust** (all `Cargo.toml` files that are actual projects, not workspaces-only files):
- Package name, current version spec (from `[dependencies]` and `[dev-dependencies]`)
- Which workspace it was found in

## Scope filtering

Apply these filters in order:
1. `{workflow.workspace_scope}` — only scan listed workspace directories. Empty = all.
2. `{workflow.package_scope}` — only include these packages in the manifest. Empty = all.
3. `{workflow.skip_packages}` — exclude these packages from the manifest.

When CLI args are provided (`--workspace`, `--packages`, `--skip-packages`), those override the config defaults for this run.

## Script-assisted discovery

Run the prepass script for a compact JSON manifest:

```
python3 {skill-root}/scripts/discover-deps.py
  [--workspace <path> ...]
  [--packages <pkg> ...]
  [--skip-packages <pkg> ...]
```

The script scans all files, resolves workspace membership, filters internal deps, applies scope filters, and emits the exact JSON schema below. Read the script's output as your manifest — no need to manually read raw config files.

## Output

Produce a structured manifest with three lists:

```json
{
  "js_deps": [
    { "name": "next", "current": "16.2.6", "workspaces": ["apps/webview-ui"] },
    ...
  ],
  "rust_deps": [
    { "name": "actix-web", "current": "4.13.0", "workspace": "apps/server" },
    ...
  ],
  "workspace_paths": {
    "js": ["apps/webview-ui", "packages/client", ...],
    "rust": ["apps/server", "packages/benchmarks"]
  }
}
```

Note any deps that already have exact pinned versions vs range specifiers (`^`, `~`). The pinning stage needs this to know where pin-exact matters. Save the manifest — the next stage consumes it.