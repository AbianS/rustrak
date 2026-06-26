use serde::{Deserialize, Serialize};

/// Request body for a cleanup (preview or execute): remove data older than
/// `older_than_days`, optionally scoped to a single project (omit for all).
///
/// `older_than_days` must be at least 1 — the service rejects smaller values,
/// since a window of 0 (or negative) would move the cutoff to now/the future and
/// purge the entire dataset.
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CleanupRequest {
    #[cfg_attr(feature = "openapi", schema(minimum = 1))]
    pub older_than_days: i64,
    #[serde(default)]
    pub project_id: Option<i32>,
}

/// Instance-wide storage summary: what Rustrak is holding right now.
///
/// Row counts are exact (indexed `COUNT(*)`). `total_db_size_bytes` is a
/// best-effort figure from the backend (`pg_database_size` / SQLite page count),
/// while `source_maps` is exact (summed `size` columns).
#[derive(Debug, Default, Serialize, PartialEq)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct StorageSummary {
    /// Whole-database size in bytes (best-effort, backend-reported).
    pub total_db_size_bytes: i64,
    pub events_count: i64,
    pub transactions_count: i64,
    pub spans_count: i64,
    pub logs_count: i64,
    /// Exact source-map weight + file count.
    pub source_maps: SourceMapStorage,
}

/// Rows affected by a cleanup, used symmetrically for the dry-run preview ("what
/// would be removed") and the executed result ("what was removed"). `spans` are
/// counted directly even though they cascade from `transactions`, so the UI can
/// show the true row impact. `issues_removed` is the number of issues that would
/// be left with zero events and therefore deleted.
#[derive(Debug, Default, Serialize, PartialEq)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CleanupCounts {
    pub events: i64,
    pub transactions: i64,
    pub spans: i64,
    pub logs: i64,
    pub issues_removed: i64,
}

/// Outcome of a source-map garbage collection: orphaned `source_file` rows
/// (no `source_file_metadata` referencing them) removed from the DB and unlinked
/// from disk. `bytes_freed` is the exact summed `size` of the removed files.
#[derive(Debug, Default, Serialize, PartialEq)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct SourceMapGcResult {
    pub files_removed: i64,
    pub bytes_freed: i64,
}

/// Per-project storage breakdown, one row per project (including empty ones).
///
/// Counts are exact. `estimated_bytes` is the summed length of the JSON payloads
/// this project owns across events/transactions/spans — a real per-project weight,
/// not an apportioned guess.
#[derive(Debug, Default, Serialize, PartialEq)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ProjectStorage {
    pub project_id: i32,
    pub project_name: String,
    pub events_count: i64,
    pub transactions_count: i64,
    pub spans_count: i64,
    pub logs_count: i64,
    pub source_maps_count: i64,
    pub estimated_bytes: i64,
}

/// Exact source-map storage weight, summed from the `size` columns.
///
/// Source maps live in two places: `chunk` holds the raw upload bytes as in-DB
/// BYTEA, `source_file` holds the assembled artifact on the filesystem CAS. Both
/// carry a `size` column, so the weight is an exact SUM — no filesystem walk.
#[derive(Debug, Default, Serialize, PartialEq)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct SourceMapStorage {
    /// Bytes held in the in-DB `chunk` table (raw upload chunks).
    pub chunk_bytes: i64,
    /// Bytes held on disk via `source_file` (assembled artifacts).
    pub source_file_bytes: i64,
    /// `chunk_bytes + source_file_bytes`.
    pub total_bytes: i64,
    /// Number of `source_file` rows.
    pub file_count: i64,
}
