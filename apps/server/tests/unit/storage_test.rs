//! TDD tests for the Storage feature — StorageService stats (Fase 1).
//!
//! Level 2 — service DB behavior tests, #[tokio::test] + TestDb.
//! Default test backend is SQLite (see Cargo.toml `default = ["sqlite"]`).

use crate::common::TestDb;
use bytes::Bytes;
use chrono::Utc;
use rustrak::models::CreateProject;
use rustrak::services::sourcemap_store::{LocalSourceMapStore, SourceMapStore};
use rustrak::services::{ProjectService, StorageService};
use std::sync::atomic::{AtomicI32, Ordering};
use tempfile::tempdir;
use uuid::Uuid;

/// Monotonic source of `digest_order` so seeded issues never collide on the
/// `UNIQUE(project_id, digest_order)` constraint within a project.
static DIGEST_ORDER: AtomicI32 = AtomicI32::new(1);

/// Inserts a chunk row directly (CAS table: checksum PK, size, data BYTEA).
async fn insert_chunk(pool: &rustrak::db::DbPool, checksum: &str, size: i64) {
    sqlx::query("INSERT INTO chunk (checksum, size, data) VALUES ($1, $2, $3)")
        .bind(checksum)
        .bind(size)
        .bind(Vec::<u8>::new())
        .execute(pool)
        .await
        .unwrap();
}

/// Inserts a source_file row directly (CAS table on disk: id, checksum, size,
/// storage_path). `storage_path == checksum` mirrors production: the checksum IS
/// the CAS key. No metadata row, so it counts as an orphan for GC.
async fn insert_source_file(pool: &rustrak::db::DbPool, checksum: &str, size: i64) {
    sqlx::query(
        "INSERT INTO source_file (id, checksum, size, storage_path) VALUES ($1, $2, $3, $4)",
    )
    .bind(Uuid::new_v4())
    .bind(checksum)
    .bind(size)
    .bind(checksum)
    .execute(pool)
    .await
    .unwrap();
}

/// Seeds a source map owned by a project: a `source_file` row plus the
/// `source_file_metadata` link that ties it to the project via debug_id.
async fn seed_project_source_map(pool: &rustrak::db::DbPool, project_id: i32, checksum: &str) {
    let file_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO source_file (id, checksum, size, storage_path) VALUES ($1, $2, $3, $4)",
    )
    .bind(file_id)
    .bind(checksum)
    .bind(300_i64)
    .bind(format!("/store/{checksum}"))
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO source_file_metadata (id, project_id, debug_id, file_type, file_id) \
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(Uuid::new_v4())
    .bind(project_id)
    .bind(Uuid::new_v4())
    .bind("source_map")
    .bind(file_id)
    .execute(pool)
    .await
    .unwrap();
}

/// Seeds one error event by hand (project → issue → grouping → event) stamped at
/// `ingested_at`. The full FK chain is the price of an exact `events` COUNT
/// without the ingest pipeline.
async fn seed_event_at(
    pool: &rustrak::db::DbPool,
    project_id: i32,
    ingested_at: chrono::DateTime<Utc>,
) {
    let issue_id = Uuid::new_v4();
    let now = ingested_at;
    let digest_order = DIGEST_ORDER.fetch_add(1, Ordering::Relaxed);
    sqlx::query(
        "INSERT INTO issues (id, project_id, digest_order, first_seen, last_seen) \
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(issue_id)
    .bind(project_id)
    .bind(digest_order)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .unwrap();

    let grouping_id: i32 = sqlx::query_scalar(
        "INSERT INTO groupings (project_id, issue_id, grouping_key, grouping_key_hash) \
         VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(project_id)
    .bind(issue_id)
    .bind(format!("key-{digest_order}"))
    .bind(format!("{digest_order:0>64}")) // unique 64-char hash per seeded event
    .fetch_one(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO events \
         (id, event_id, project_id, issue_id, grouping_id, data, timestamp, ingested_at, digested_at, digest_order) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
    )
    .bind(Uuid::new_v4())
    .bind(Uuid::new_v4())
    .bind(project_id)
    .bind(issue_id)
    .bind(grouping_id)
    .bind(serde_json::json!({}))
    .bind(now)
    .bind(now)
    .bind(now)
    .bind(1_i32)
    .execute(pool)
    .await
    .unwrap();
}

/// Seeds an issue-less event row of an arbitrary `event_type` directly into the
/// `events` table (NULL `issue_id`/`grouping_id`) stamped at `ingested_at`. This
/// is the shape of non-error rows: legacy `transaction` rows stranded from before
/// the dedicated table, or future types like `log`. None of them ever
/// incremented a counter.
async fn seed_issueless_event_at(
    pool: &rustrak::db::DbPool,
    project_id: i32,
    event_type: &str,
    ingested_at: chrono::DateTime<Utc>,
) {
    let now = ingested_at;
    sqlx::query(
        "INSERT INTO events \
         (id, event_id, project_id, data, timestamp, ingested_at, digested_at, digest_order, event_type) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(Uuid::new_v4())
    .bind(Uuid::new_v4())
    .bind(project_id)
    .bind(serde_json::json!({ "event_type": event_type }))
    .bind(now)
    .bind(now)
    .bind(now)
    .bind(1_i32)
    .bind(event_type)
    .execute(pool)
    .await
    .unwrap();
}

/// Convenience: the legacy `transaction`-in-`events` shape.
async fn seed_legacy_transaction_event_at(
    pool: &rustrak::db::DbPool,
    project_id: i32,
    ingested_at: chrono::DateTime<Utc>,
) {
    seed_issueless_event_at(pool, project_id, "transaction", ingested_at).await;
}

/// Seeds one transaction (stamped at `ingested_at`) plus `span_count` spans
/// cascaded under it.
async fn seed_transaction_with_spans_at(
    pool: &rustrak::db::DbPool,
    project_id: i32,
    span_count: usize,
    ingested_at: chrono::DateTime<Utc>,
) {
    let txn_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO transactions (id, event_id, project_id, timestamp, ingested_at, data) \
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(txn_id)
    .bind(Uuid::new_v4())
    .bind(project_id)
    .bind(ingested_at)
    .bind(ingested_at)
    .bind(serde_json::json!({}))
    .execute(pool)
    .await
    .unwrap();

    for _ in 0..span_count {
        sqlx::query(
            "INSERT INTO spans (id, transaction_id, project_id, data) VALUES ($1, $2, $3, $4)",
        )
        .bind(Uuid::new_v4())
        .bind(txn_id)
        .bind(project_id)
        .bind(serde_json::json!({}))
        .execute(pool)
        .await
        .unwrap();
    }
}

/// Convenience wrappers stamping data at "now" for tests that don't care about age.
async fn seed_event(pool: &rustrak::db::DbPool, project_id: i32) {
    seed_event_at(pool, project_id, Utc::now()).await;
}

async fn seed_transaction_with_spans(
    pool: &rustrak::db::DbPool,
    project_id: i32,
    span_count: usize,
) {
    seed_transaction_with_spans_at(pool, project_id, span_count, Utc::now()).await;
}

#[tokio::test]
async fn test_preview_cleanup_counts_old_rows_without_mutating() {
    // A dry-run must report exactly what an execute would remove — old rows only —
    // and touch nothing. It's the safety net before a destructive delete.
    let db = TestDb::new().await;
    let project = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "preview-proj".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();

    let old = Utc::now() - chrono::Duration::days(60);
    let now = Utc::now();
    seed_event_at(&db.pool, project.id, old).await; // its issue will be emptied
    seed_event_at(&db.pool, project.id, now).await;
    seed_transaction_with_spans_at(&db.pool, project.id, 2, old).await;
    seed_transaction_with_spans_at(&db.pool, project.id, 1, now).await;

    let preview = StorageService::preview_cleanup(&db.pool, 30, None)
        .await
        .unwrap();

    assert_eq!(preview.events, 1, "one event older than 30d");
    assert_eq!(preview.transactions, 1);
    assert_eq!(preview.spans, 2, "spans under the old transaction");
    assert_eq!(
        preview.issues_removed, 1,
        "the old event's issue empties out"
    );

    // Nothing was deleted.
    let summary = StorageService::global_summary(&db.pool).await.unwrap();
    assert_eq!(summary.events_count, 2);
    assert_eq!(summary.transactions_count, 2);
    assert_eq!(summary.spans_count, 3);
}

#[tokio::test]
async fn test_cleanup_rejects_nonpositive_retention_window() {
    // A window of 0 puts the cutoff at "now" and a negative one in the future —
    // either turns the cleanup into a full data wipe. Both preview and execute
    // must reject anything below 1 day before computing a cutoff, so a direct API
    // caller can't bypass the client-side `min(1)` and lose everything.
    let db = TestDb::new().await;
    let project = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "retention-guard".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();

    seed_event(&db.pool, project.id).await;

    for bad in [0_i64, -1, -365] {
        assert!(
            StorageService::preview_cleanup(&db.pool, bad, None)
                .await
                .is_err(),
            "preview must reject older_than_days = {bad}"
        );
        assert!(
            StorageService::execute_cleanup(&db.pool, bad, None)
                .await
                .is_err(),
            "execute must reject older_than_days = {bad}"
        );
    }

    // The rejected execute calls deleted nothing.
    let summary = StorageService::global_summary(&db.pool).await.unwrap();
    assert_eq!(summary.events_count, 1, "no data was purged");
}

#[tokio::test]
async fn test_gc_source_maps_keeps_file_that_is_referenced_at_delete_time() {
    // The orphan list is a point-in-time snapshot, but the delete re-checks
    // `NOT EXISTS(metadata)` atomically. A source_file that has a metadata row is
    // never removed — guarding the window where a concurrent upload re-references
    // a row the snapshot saw as an orphan.
    let db = TestDb::new().await;
    let tmp = tempdir().unwrap();
    let store = LocalSourceMapStore::new(tmp.path());

    let project = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "gc-recheck".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();

    let referenced = "d".repeat(40);
    seed_project_source_map(&db.pool, project.id, &referenced).await;
    store
        .put(&referenced, Bytes::from_static(b"ref"))
        .await
        .unwrap();

    let result = StorageService::gc_source_maps(&db.pool, &store)
        .await
        .unwrap();

    assert_eq!(
        result.files_removed, 0,
        "referenced file is never collected"
    );
    assert_eq!(result.bytes_freed, 0);
    assert!(
        store.exists(&referenced).await.unwrap(),
        "referenced file kept on disk"
    );
}

#[tokio::test]
async fn test_execute_cleanup_deletes_old_cascades_spans_and_removes_empty_issues() {
    // Execute is the destructive twin of preview: old rows gone, spans cascade
    // away with their transaction, recent data untouched, and the issue left with
    // no events is deleted — no ghost issues.
    let db = TestDb::new().await;
    let project = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "execute-proj".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();

    let old = Utc::now() - chrono::Duration::days(60);
    let now = Utc::now();
    seed_event_at(&db.pool, project.id, old).await;
    seed_event_at(&db.pool, project.id, now).await;
    seed_transaction_with_spans_at(&db.pool, project.id, 2, old).await;
    seed_transaction_with_spans_at(&db.pool, project.id, 1, now).await;

    let result = StorageService::execute_cleanup(&db.pool, 30, None)
        .await
        .unwrap();

    assert_eq!(result.events, 1);
    assert_eq!(result.transactions, 1);
    assert_eq!(result.spans, 2);
    assert_eq!(result.issues_removed, 1);

    // Only the recent rows survive.
    let summary = StorageService::global_summary(&db.pool).await.unwrap();
    assert_eq!(summary.events_count, 1, "recent event survives");
    assert_eq!(summary.transactions_count, 1);
    assert_eq!(summary.spans_count, 1, "recent transaction's span survives");

    let issues_left: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM issues")
        .fetch_one(&db.pool)
        .await
        .unwrap();
    assert_eq!(issues_left, 1, "emptied issue removed, recent issue kept");
}

#[tokio::test]
async fn test_execute_cleanup_decrements_project_event_counters() {
    // Regression guard: deleting events must keep the denormalized
    // projects.{stored,digested}_event_count in sync — same contract as
    // IssueService::delete. A raw DELETE that skips this leaves stale counts.
    let db = TestDb::new().await;
    let project = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "counter-proj".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();

    let old = Utc::now() - chrono::Duration::days(60);
    let now = Utc::now();
    seed_event_at(&db.pool, project.id, old).await; // its issue empties out
    seed_event_at(&db.pool, project.id, now).await; // survives

    // Reflect the two seeded events on the project counters (the digest path
    // would have done this in production).
    sqlx::query(
        "UPDATE projects SET stored_event_count = 2, digested_event_count = 2 WHERE id = $1",
    )
    .bind(project.id)
    .execute(&db.pool)
    .await
    .unwrap();

    StorageService::execute_cleanup(&db.pool, 30, None)
        .await
        .unwrap();

    let (stored, digested): (i32, i32) = sqlx::query_as(
        "SELECT stored_event_count, digested_event_count FROM projects WHERE id = $1",
    )
    .bind(project.id)
    .fetch_one(&db.pool)
    .await
    .unwrap();

    assert_eq!(stored, 1, "one of two events removed → count drops to 1");
    assert_eq!(digested, 1);
}

#[tokio::test]
async fn test_execute_cleanup_purges_legacy_transaction_events_without_underflowing_counters() {
    // Legacy `event_type='transaction'` rows never incremented the project
    // counters. A cleanup that catches them must still physically purge the rows
    // while leaving the project's error-event counters correct (the counters are
    // rebuilt from the surviving issues, so deleting issue-less rows can't drive
    // them negative).
    let db = TestDb::new().await;
    let project = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "tx-underflow".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();

    let old = Utc::now() - chrono::Duration::days(60);
    seed_event(&db.pool, project.id).await; // one recent error event, survives
    seed_legacy_transaction_event_at(&db.pool, project.id, old).await;
    seed_legacy_transaction_event_at(&db.pool, project.id, old).await;

    // Counter reflects the single error event the digest path would have counted.
    sqlx::query(
        "UPDATE projects SET stored_event_count = 1, digested_event_count = 1 WHERE id = $1",
    )
    .bind(project.id)
    .execute(&db.pool)
    .await
    .unwrap();

    StorageService::execute_cleanup(&db.pool, 30, None)
        .await
        .unwrap();

    let (stored, digested): (i32, i32) = sqlx::query_as(
        "SELECT stored_event_count, digested_event_count FROM projects WHERE id = $1",
    )
    .bind(project.id)
    .fetch_one(&db.pool)
    .await
    .unwrap();
    assert_eq!(
        stored, 1,
        "error-event counter untouched by transaction purge"
    );
    assert_eq!(digested, 1);

    // The legacy transaction rows are gone; the error event remains.
    let tx_left: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM events WHERE event_type = 'transaction'")
            .fetch_one(&db.pool)
            .await
            .unwrap();
    assert_eq!(
        tx_left, 0,
        "old legacy transaction events physically purged"
    );

    let summary = StorageService::global_summary(&db.pool).await.unwrap();
    assert_eq!(summary.events_count, 1, "the error event survives");
}

#[tokio::test]
async fn test_execute_cleanup_deletes_every_old_row_regardless_of_type() {
    // The user-facing contract: a cleanup deletes EVERYTHING older than the cutoff
    // with no exceptions — errors and legacy transaction rows alike — and the
    // surviving project counter still equals the surviving error events.
    let db = TestDb::new().await;
    let project = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "delete-all".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();

    let old = Utc::now() - chrono::Duration::days(60);
    let now = Utc::now();
    seed_event_at(&db.pool, project.id, old).await; // old error → deleted
    seed_event_at(&db.pool, project.id, now).await; // recent error → survives
    seed_legacy_transaction_event_at(&db.pool, project.id, old).await; // deleted
    seed_legacy_transaction_event_at(&db.pool, project.id, old).await; // deleted

    // Two error events were counted by the digest path.
    sqlx::query(
        "UPDATE projects SET stored_event_count = 2, digested_event_count = 2 WHERE id = $1",
    )
    .bind(project.id)
    .execute(&db.pool)
    .await
    .unwrap();

    StorageService::execute_cleanup(&db.pool, 30, None)
        .await
        .unwrap();

    // Every old row gone (1 error + 2 transactions); only the recent error remains.
    let total_events: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM events")
        .fetch_one(&db.pool)
        .await
        .unwrap();
    assert_eq!(
        total_events, 1,
        "all old rows deleted, recent error survives"
    );

    let (stored, digested): (i32, i32) = sqlx::query_as(
        "SELECT stored_event_count, digested_event_count FROM projects WHERE id = $1",
    )
    .bind(project.id)
    .fetch_one(&db.pool)
    .await
    .unwrap();
    assert_eq!(stored, 1, "counter tracks the one surviving error event");
    assert_eq!(digested, 1);
}

#[tokio::test]
async fn test_execute_cleanup_scoped_to_project_spares_other_projects() {
    // Safety guard: a project-scoped purge must never reach into a sibling
    // project's data, no matter how old that data is.
    let db = TestDb::new().await;
    let proj_a = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "scope-a".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();
    let proj_b = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "scope-b".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();

    let old = Utc::now() - chrono::Duration::days(60);
    seed_event_at(&db.pool, proj_a.id, old).await;
    seed_transaction_with_spans_at(&db.pool, proj_a.id, 1, old).await;
    seed_event_at(&db.pool, proj_b.id, old).await;
    seed_transaction_with_spans_at(&db.pool, proj_b.id, 1, old).await;

    StorageService::execute_cleanup(&db.pool, 30, Some(proj_a.id))
        .await
        .unwrap();

    let rows = StorageService::by_project(&db.pool).await.unwrap();
    let a = rows.iter().find(|r| r.project_id == proj_a.id).unwrap();
    let b = rows.iter().find(|r| r.project_id == proj_b.id).unwrap();

    assert_eq!(a.events_count, 0, "scoped project purged");
    assert_eq!(a.transactions_count, 0);
    assert_eq!(b.events_count, 1, "sibling project untouched");
    assert_eq!(b.transactions_count, 1);
    assert_eq!(b.spans_count, 1);
}

#[tokio::test]
async fn test_storage_event_count_reflects_every_stored_event_row() {
    // The storage page shows the truth of what's on disk: every `events` row
    // counts, no exceptions — errors, future types (e.g. `log`), and legacy
    // `transaction` rows alike. Admins must see the real total so they know
    // there's data to reclaim; a cleanup then deletes it all by date.
    let db = TestDb::new().await;
    let project = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "mixed-types".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();

    seed_event(&db.pool, project.id).await; // error event (has an issue)
    seed_issueless_event_at(&db.pool, project.id, "log", Utc::now()).await;
    seed_legacy_transaction_event_at(&db.pool, project.id, Utc::now()).await;
    seed_legacy_transaction_event_at(&db.pool, project.id, Utc::now()).await;

    let summary = StorageService::global_summary(&db.pool).await.unwrap();
    assert_eq!(
        summary.events_count, 4,
        "every stored event row counts: error + log + 2 transactions"
    );

    let rows = StorageService::by_project(&db.pool).await.unwrap();
    let p = rows.iter().find(|r| r.project_id == project.id).unwrap();
    assert_eq!(
        p.events_count, 4,
        "per-project count reflects all stored event rows"
    );
}

#[tokio::test]
async fn test_global_summary_counts_rows_across_data_categories() {
    // The summary is the at-a-glance number: exact row counts per data category,
    // exact source-map weight, and a non-zero whole-DB size from the backend.
    let db = TestDb::new().await;
    let project = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "summary-proj".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();

    seed_event(&db.pool, project.id).await;
    seed_transaction_with_spans(&db.pool, project.id, 2).await;
    seed_transaction_with_spans(&db.pool, project.id, 1).await;
    insert_chunk(&db.pool, "a".repeat(40).as_str(), 100).await;
    insert_source_file(&db.pool, "c".repeat(40).as_str(), 300).await;

    let summary = StorageService::global_summary(&db.pool).await.unwrap();

    assert_eq!(summary.events_count, 1);
    assert_eq!(summary.transactions_count, 2);
    assert_eq!(summary.spans_count, 3, "2 + 1 spans");
    assert_eq!(summary.source_maps.total_bytes, 400, "100 chunk + 300 file");
    assert!(summary.total_db_size_bytes > 0, "backend reports a DB size");
}

#[tokio::test]
async fn test_by_project_breaks_down_counts_per_project_with_isolation() {
    // Per-project view: every project shows up (even empty ones), counts are
    // exact, and one project's data never bleeds into another's row.
    let db = TestDb::new().await;
    let proj_a = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "proj-a".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();
    let proj_b = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "proj-b".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();

    // Only proj_a gets data; proj_b stays empty.
    seed_event(&db.pool, proj_a.id).await;
    seed_transaction_with_spans(&db.pool, proj_a.id, 2).await;
    seed_project_source_map(&db.pool, proj_a.id, "d".repeat(40).as_str()).await;

    let rows = StorageService::by_project(&db.pool).await.unwrap();

    let a = rows
        .iter()
        .find(|r| r.project_id == proj_a.id)
        .expect("proj-a present");
    assert_eq!(a.project_name, "proj-a");
    assert_eq!(a.events_count, 1);
    assert_eq!(a.transactions_count, 1);
    assert_eq!(a.spans_count, 2);
    assert_eq!(a.source_maps_count, 1);
    assert!(a.estimated_bytes > 0, "proj-a holds payload bytes");

    let b = rows
        .iter()
        .find(|r| r.project_id == proj_b.id)
        .expect("proj-b present");
    assert_eq!(b.events_count, 0);
    assert_eq!(b.transactions_count, 0);
    assert_eq!(b.spans_count, 0);
    assert_eq!(b.source_maps_count, 0);
    assert_eq!(b.estimated_bytes, 0, "empty project weighs nothing");
}

#[tokio::test]
async fn test_preview_source_map_gc_counts_orphans_without_deleting() {
    // The GC dry-run reports the orphaned files + bytes a real GC would reclaim,
    // and deletes nothing — same safety contract as the time-based preview.
    let db = TestDb::new().await;
    let project = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "gc-preview".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();

    seed_project_source_map(&db.pool, project.id, &"a".repeat(40)).await; // referenced
    insert_source_file(&db.pool, &"b".repeat(40), 500).await; // orphan

    let preview = StorageService::preview_source_map_gc(&db.pool)
        .await
        .unwrap();

    assert_eq!(preview.files_removed, 1, "one orphan would be removed");
    assert_eq!(preview.bytes_freed, 500);

    // Nothing deleted: both source_file rows still present.
    let storage = StorageService::source_map_storage(&db.pool).await.unwrap();
    assert_eq!(storage.file_count, 2);
}

#[tokio::test]
async fn test_gc_source_maps_removes_orphans_from_db_and_disk() {
    // GC reclaims source_file rows that no metadata references (e.g. left behind
    // when a project was deleted — metadata cascades, the CAS file does not). The
    // orphan's DB row AND its on-disk file must go; referenced files are untouched.
    let db = TestDb::new().await;
    let tmp = tempdir().unwrap();
    let store = LocalSourceMapStore::new(tmp.path());

    let project = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "gc-proj".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();

    // 40-char hex checksums == valid CAS keys.
    let referenced = "a".repeat(40);
    let orphan = "b".repeat(40);

    seed_project_source_map(&db.pool, project.id, &referenced).await; // has metadata
    insert_source_file(&db.pool, &orphan, 500).await; // no metadata → orphan

    store
        .put(&referenced, Bytes::from_static(b"ref"))
        .await
        .unwrap();
    store
        .put(&orphan, Bytes::from_static(b"orphan"))
        .await
        .unwrap();

    let result = StorageService::gc_source_maps(&db.pool, &store)
        .await
        .unwrap();

    assert_eq!(result.files_removed, 1, "only the orphan is removed");
    assert_eq!(result.bytes_freed, 500);

    // Orphan gone from DB and disk; referenced file survives both.
    assert!(
        !store.exists(&orphan).await.unwrap(),
        "orphan unlinked from disk"
    );
    assert!(
        store.exists(&referenced).await.unwrap(),
        "referenced file kept"
    );

    let storage = StorageService::source_map_storage(&db.pool).await.unwrap();
    assert_eq!(
        storage.file_count, 1,
        "only the referenced source_file row remains"
    );
}

#[tokio::test]
async fn test_source_map_storage_sums_chunk_and_source_file_sizes() {
    // Source-map storage weight is exact: it's the SUM of the `size` columns on
    // `chunk` (in-DB BYTEA) and `source_file` (on-disk CAS). No filesystem walk.
    let db = TestDb::new().await;

    insert_chunk(&db.pool, "a".repeat(40).as_str(), 100).await;
    insert_chunk(&db.pool, "b".repeat(40).as_str(), 250).await;
    insert_source_file(&db.pool, "c".repeat(40).as_str(), 300).await;

    let storage = StorageService::source_map_storage(&db.pool).await.unwrap();

    assert_eq!(storage.chunk_bytes, 350, "100 + 250");
    assert_eq!(storage.source_file_bytes, 300);
    assert_eq!(storage.total_bytes, 650);
    assert_eq!(storage.file_count, 1, "one source_file row");
}
