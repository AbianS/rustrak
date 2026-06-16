# Resolve and Pin

Take the dependency manifest produced by the discovery stage and update every external dependency to its latest available version, pinned to an exact version.

## JS/TypeScript

For each JS workspace, run:

```
ncu --packageFile <path/to/package.json> --upgrade --target latest --removeRange
```

- `--upgrade` writes changes directly to `package.json` (non-interactive).
- `--target latest` gets the absolute latest, including major bumps.
- `--removeRange` strips `^` and `~` prefixes so all versions are pinned exact. In ncu v22+, this replaces the removed `--save-exact` flag.
- If `ncu` is not available, install it with `npm install -g npm-check-updates` or use `pnpm dlx npm-check-updates`.

After running `ncu`, verify EVERY dep has an exact version (no `^`, `~`, `>=` prefixes). `--removeRange` only strips ranges from packages that were actually updated — any pinned ranges on un-updated packages must be fixed manually. Scan for residual `^`/`~` in all updated `package.json` files and strip them.

## Rust

For each Rust workspace directory (containing `Cargo.toml`), run `cargo upgrade` from that directory:

```
cd apps/server && cargo upgrade
cd packages/benchmarks && cargo upgrade
```

**Note**: `cargo upgrade` does NOT support `--workspace`. Run it per-workspace directory.

From `cargo-edit` crate. If not installed: `cargo install cargo-edit`.

Cargo already uses exact versions, so no pinning step is needed.

For incompatible (major) bumps, re-run with `--incompatible allow` to see available major versions. Flag any that update for breaking change review.

## Post-update install

After all JS and Rust updates are written to manifest files, install the new deps and update lockfiles:

```
pnpm install --no-frozen-lockfile
```

This ensures the lockfile (`pnpm-lock.yaml`, `Cargo.lock`) reflects the new versions before proceeding to verification.

## Diff

After all updates, run `git diff` and note every dependency that changed:
- Package name
- From version → To version
- Whether it's a major, minor, or patch bump
- Which workspace file was modified

This diff feeds into the codemod stage (runs per updated package) and breaking-change detection (identifies major bumps). Save it — you'll need it later.