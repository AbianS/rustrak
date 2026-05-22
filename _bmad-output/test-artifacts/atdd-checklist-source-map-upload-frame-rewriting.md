---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-05-22'
storyId: 'source-map-upload-frame-rewriting'
storyKey: 'source-map-upload-frame-rewriting'
storyFile: '/Users/abiansuarezbrito/Documents/rustrak/_bmad-output/implementation-artifacts/spec-source-map-processing.md'
atddChecklistPath: '/Users/abiansuarezbrito/Documents/rustrak/_bmad-output/test-artifacts/atdd-checklist-source-map-upload-frame-rewriting.md'
generatedTestFiles:
  - 'apps/server/tests/unit/sourcemap_test.rs'
  - 'apps/server/tests/unit/sourcemap_store_test.rs'
  - 'apps/server/tests/integration/sourcemaps_api_test.rs'
---

# ATDD Checklist: Source Map Upload & Frame Rewriting

## TDD Red Phase (Current)

✅ Red-phase test scaffolds generated and verified

- Unit Tests (normalize_sentry_position): **6 tests** (all `#[ignore]`)
- Unit Tests (rewrite_frames via FakeSourceMapProvider): **9 tests** (all `#[ignore]`)
- Unit Tests (LocalSourceMapStore): **8 tests** (all `#[ignore]`)
- Integration Tests (sourcemaps API): **24 tests** (all `#[ignore]`)
- **Total: 47 red-phase scaffolds**

All scaffolds compile cleanly (`cargo test --features sqlite --no-run` ✅).

## Acceptance Criteria Coverage

| AC  | Description | Tests |
|-----|-------------|-------|
| AC1 | sentry-cli uploads without errors, source_file_metadata rows appear | test_org_probe_*, test_chunk_*, test_assemble_*, test_list_source_maps_* |
| AC2 | Stored event JSON has rewritten frame (filename, lineno, context_line) | test_rewrite_hit, test_digest_rewrites_frames_when_sourcemap_present |
| AC3 | Duplicate upload → source_file row count does not increase | test_assemble_idempotent_*, test_store_put_idempotent, test_chunk_upload_dedup_* |
| AC4 | Frame with no matching source map → stored with original values, no crash | test_rewrite_miss, test_digest_leaves_frame_unchanged_* |
| AC5 | Project A maps do not affect project B events | test_rewrite_cross_project, test_cross_project_source_maps_do_not_leak, test_list_source_maps_scoped_to_project |
| AC6 | ZIP with `../../../etc/passwd` → error state, no escape | test_assemble_zip_path_traversal_*, test_assemble_zip_symlink_*, test_store_path_traversal_in_key |
| AC7 | Worker crash → reset to 'created', retry up to max_retries, then 'error', 400 on retry | test_worker_restart_recovery_*, test_worker_exhausts_retries_*, test_assemble_failed_job_* |
| AC8 | lineno=0 → frame unchanged, no u32::MAX wraparound | test_normalize_lineno_zero, test_rewrite_lineno_zero |
| AC9 | .js.map with 20 sources, frame→source #15 → context_line from sourcesContent[15] | test_rewrite_multi_source |
| AC10 | All tests pass for both `--features postgres` and `--features sqlite` | CI matrix (not a single test — see checklist below) |

## Task → Test Activation Map

Activate the corresponding tests as each task is implemented:

| Task | Description | Tests to un-ignore |
|------|-------------|-------------------|
| T1   | PostgreSQL migration | AC10 — run `cargo test --features postgres` |
| T2   | SQLite migration | AC10 — run `cargo test --features sqlite` |
| T3   | Models (Chunk, SourceFile, SourceFileMetadata, AssemblyJob) | Compile check |
| T4   | SourceMapStore trait + LocalSourceMapStore | `tests/unit/sourcemap_store_test.rs` (8 tests) |
| T5   | Sourcemap service (normalize, store_chunks, assemble_bundle, rewrite_frames) | `tests/unit/sourcemap_test.rs` (15 tests) |
| T6   | Routes (5 handlers) | `tests/integration/sourcemaps_api_test.rs` groups: org_probe, chunk_capability, chunk_upload, assemble, list_source_maps |
| T7   | Assembly worker | `tests/integration/sourcemaps_api_test.rs` groups: worker_recovery, worker_exhausts_retries, assemble_failed_job |
| T8   | Digest integration | `tests/integration/sourcemaps_api_test.rs` groups: digest_rewrite, cross_project |
| T9   | Cargo.toml dependencies | Compile check (sourcemap="8", zip="2.3", etc.) |
| T10  | Docker + config | Manual verification |

## Activation Protocol (per task)

During implementation of each task:

1. Remove `#[ignore]` from the tests for the current task (see map above)
2. Add the production imports shown in the comment block at the top of each test group
3. Run: `cargo test --features sqlite <test_group_name>`
4. Verify the activated tests **FAIL** first (red — production code not yet implemented)
5. Implement the production code
6. Run again → tests should **PASS** (green)
7. Commit tests + implementation together

## AC10 CI Matrix Checklist

```
[ ] cargo test --features postgres  (T1 + T3 complete)
[ ] cargo test --features sqlite    (T2 + T3 complete)
[ ] AssemblyJob.chunks: Vec<String> (PG) / Json<Vec<String>> (SQLite) — verify #[cfg] compiles
[ ] chunk_list() accessor used everywhere (never .chunks directly in cross-backend code)
[ ] get_missing_chunks(): ANY($1) for PG, dynamic IN(...) for SQLite
[ ] assemble_bundle() DELETE: ANY($1) for PG, dynamic IN(...) for SQLite
[ ] SQLite JSON decode: test that AssemblyJob.chunks deserializes from TEXT column
```

## Critical Reminders for Implementors

- **`normalize_sentry_position`**: use `saturating_sub(1)` — NEVER plain `- 1` on `u32`
- **ZIP extraction**: do NOT use `canonicalize()` (fails on non-existent paths) — use manual component iteration
- **`source_file` upsert**: two separate queries (INSERT then SELECT) — `ON CONFLICT DO NOTHING RETURNING id` returns NULL on conflict
- **`file_type`**: use `"source_map"` for `.js.map` entries — NOT `"minified"` (rewrite_frames queries this exact string)
- **`code_file` HashMap key**: build from `img["code_file"]` field, not `filename` or `abs_path`
- **`sourcesContent` lookup**: ALWAYS use `token.get_source()` + linear search — NEVER `sourcesContent[0]`
- **`process_event`**: free function (not struct method) — add `sourcemap_provider` as new parameter
- **zip crate**: `zip = "2.3"` minimum — CVE-2025-29787 affects `<= 2.2.x`

## Generated Test Files

- `apps/server/tests/unit/sourcemap_test.rs` — 15 unit tests (normalize + rewrite_frames)
- `apps/server/tests/unit/sourcemap_store_test.rs` — 8 unit tests (LocalSourceMapStore)
- `apps/server/tests/integration/sourcemaps_api_test.rs` — 24 integration tests (all 5 handlers + worker + digest)

## ATDD Session Summary

- **Generation mode**: AI generation (backend-only Rust project, no browser recording)
- **Execution**: sequential (single session)
- **TDD phase**: RED — all 47 tests use `#[ignore]`
- **Compilation**: ✅ clean compile (0 errors, 0 warnings after fix)
- **Spec status**: `ready-for-dev` (spec-source-map-processing.md)
- **Next step**: implement T1–T11 using `/tdd` skill, activating test groups progressively
