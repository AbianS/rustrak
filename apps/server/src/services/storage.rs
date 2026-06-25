//! Storage stats & retention service.
//!
//! Surfaces how much data Rustrak is holding — row counts and on-disk weight,
//! globally and per project — so an admin can see what's accumulating and reclaim
//! space. Backs the Settings → Storage page.

use chrono::Utc;

use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{
    CleanupCounts, ProjectStorage, SourceMapGcResult, SourceMapStorage, StorageSummary,
};
use crate::services::sourcemap_store::SourceMapStore;

pub struct StorageService;

/// Smallest accepted retention window. A value below this would push the cutoff
/// to "now" or into the future, turning the cleanup into a full data wipe — so
/// it's rejected before any cutoff is computed. Mirrors the `min(1)` the MCP and
/// UI already enforce on the client side.
const MIN_RETENTION_DAYS: i64 = 1;

/// Rejects retention windows that would delete current/future data. Shared by the
/// preview and execute paths so both fail fast on the same contract.
fn validate_retention(older_than_days: i64) -> AppResult<()> {
    if older_than_days < MIN_RETENTION_DAYS {
        return Err(AppError::Validation(format!(
            "older_than_days must be at least {MIN_RETENTION_DAYS}"
        )));
    }
    Ok(())
}

impl StorageService {
    /// Dry-run for [`Self::gc_source_maps`]: counts the orphaned `source_file`
    /// rows and the bytes a GC would reclaim. Mutates nothing.
    pub async fn preview_source_map_gc(pool: &DbPool) -> AppResult<SourceMapGcResult> {
        // `size` is INT, so SUM(size) is BIGINT on Postgres (and integer on SQLite)
        // — both decode to i64. Casting size to BIGINT *before* SUM would make
        // Postgres return NUMERIC, which sqlx cannot decode into i64.
        let (files_removed, bytes_freed): (i64, i64) = sqlx::query_as(
            r#"
            SELECT
                COUNT(*),
                COALESCE(SUM(sf.size), 0)
            FROM source_file sf
            WHERE NOT EXISTS (
                SELECT 1 FROM source_file_metadata m WHERE m.file_id = sf.id
            )
            "#,
        )
        .fetch_one(pool)
        .await?;

        Ok(SourceMapGcResult {
            files_removed,
            bytes_freed,
        })
    }

    /// Garbage-collects orphaned source maps: `source_file` rows that no
    /// `source_file_metadata` references. Removes the DB row and unlinks the file
    /// from the CAS. Never touches referenced files.
    pub async fn gc_source_maps(
        pool: &DbPool,
        store: &dyn SourceMapStore,
    ) -> AppResult<SourceMapGcResult> {
        // Orphans: source_file rows with no metadata pointing at them. This is a
        // point-in-time snapshot — uploads dedup on `checksum`, so a concurrent
        // upload can re-reference one of these rows before we reach it below.
        let orphans: Vec<(String,)> = sqlx::query_as(
            r#"
            SELECT sf.checksum
            FROM source_file sf
            WHERE NOT EXISTS (
                SELECT 1 FROM source_file_metadata m WHERE m.file_id = sf.id
            )
            "#,
        )
        .fetch_all(pool)
        .await?;

        let mut files_removed = 0_i64;
        let mut bytes_freed = 0_i64;

        for (checksum,) in orphans {
            // Re-check orphan status atomically at delete time: the row is only
            // removed if it's STILL unreferenced, closing the window where a
            // concurrent upload re-attached metadata to it. `RETURNING` hands back
            // the path/size of the row we actually deleted (None if it's no longer
            // an orphan), so we never unlink a file that's back in use.
            let deleted: Option<(String, i64)> = sqlx::query_as(
                r#"
                DELETE FROM source_file
                WHERE checksum = $1
                  AND NOT EXISTS (
                      SELECT 1 FROM source_file_metadata m WHERE m.file_id = source_file.id
                  )
                RETURNING storage_path, CAST(size AS BIGINT)
                "#,
            )
            .bind(&checksum)
            .fetch_optional(pool)
            .await?;

            if let Some((storage_path, size)) = deleted {
                // The DB row is gone; now unlink the file. The store's delete is
                // idempotent (a missing file is not an error), so a crash here just
                // leaves a stray file that a rerun re-reaps.
                let _ = store.delete(&storage_path).await;
                files_removed += 1;
                bytes_freed += size;
            }
        }

        Ok(SourceMapGcResult {
            files_removed,
            bytes_freed,
        })
    }

    /// Dry-run: counts the rows a cleanup of data older than `older_than_days`
    /// would remove (optionally scoped to one project). Mutates nothing.
    pub async fn preview_cleanup(
        pool: &DbPool,
        older_than_days: i64,
        project_id: Option<i32>,
    ) -> AppResult<CleanupCounts> {
        validate_retention(older_than_days)?;
        let cutoff = Utc::now() - chrono::Duration::days(older_than_days);
        Self::count_cleanup(pool, cutoff, project_id).await
    }

    /// Executes a cleanup: deletes data older than `older_than_days` (optionally
    /// scoped to one project) and removes any issue left with zero events. Returns
    /// the same shape as the preview. Runs in a single transaction so a failure
    /// rolls the whole purge back.
    pub async fn execute_cleanup(
        pool: &DbPool,
        older_than_days: i64,
        project_id: Option<i32>,
    ) -> AppResult<CleanupCounts> {
        validate_retention(older_than_days)?;
        let cutoff = Utc::now() - chrono::Duration::days(older_than_days);
        let counts = Self::count_cleanup(pool, cutoff, project_id).await?;

        let mut tx = pool.begin().await?;

        // Transactions first — their spans cascade away via ON DELETE CASCADE.
        sqlx::query(
            "DELETE FROM transactions WHERE ingested_at < $1 AND ($2 IS NULL OR project_id = $3)",
        )
        .bind(cutoff)
        .bind(project_id)
        .bind(project_id)
        .execute(&mut *tx)
        .await?;

        // Keep the per-issue event counters in sync BEFORE deleting the rows. The
        // `e.issue_id = issues.id` join means only events that belong to an issue
        // (errors) are ever subtracted — transaction/log rows carry a NULL
        // issue_id and never touched these counters, so they can't underflow them.
        // Correlated subqueries keep this dialect-portable.
        sqlx::query(
            r#"
            UPDATE issues SET
                stored_event_count = stored_event_count - (
                    SELECT COUNT(*) FROM events e
                    WHERE e.issue_id = issues.id AND e.ingested_at < $1
                      AND ($2 IS NULL OR e.project_id = $3)
                ),
                digested_event_count = digested_event_count - (
                    SELECT COUNT(*) FROM events e
                    WHERE e.issue_id = issues.id AND e.ingested_at < $4
                      AND ($5 IS NULL OR e.project_id = $6)
                )
            WHERE EXISTS (
                SELECT 1 FROM events e
                WHERE e.issue_id = issues.id AND e.ingested_at < $7
                  AND ($8 IS NULL OR e.project_id = $9)
            )
            "#,
        )
        .bind(cutoff)
        .bind(project_id)
        .bind(project_id)
        .bind(cutoff)
        .bind(project_id)
        .bind(project_id)
        .bind(cutoff)
        .bind(project_id)
        .bind(project_id)
        .execute(&mut *tx)
        .await?;

        // Rebuild each in-scope project's counters from the (now-updated) issue
        // counters instead of subtracting an event delta. The project counter is
        // by definition the sum of its issues' counts, so this is always correct
        // and can never underflow — no event_type/issue_id predicate needed, and
        // it heals any pre-existing drift. The DELETE below still removes every
        // old row (transactions included); those rows simply never had a counter.
        sqlx::query(
            r#"
            UPDATE projects SET
                stored_event_count = (
                    SELECT COALESCE(SUM(i.stored_event_count), 0)
                    FROM issues i WHERE i.project_id = projects.id
                ),
                digested_event_count = (
                    SELECT COALESCE(SUM(i.digested_event_count), 0)
                    FROM issues i WHERE i.project_id = projects.id
                )
            WHERE ($1 IS NULL OR projects.id = $2)
            "#,
        )
        .bind(project_id)
        .bind(project_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "DELETE FROM events WHERE ingested_at < $1 AND ($2 IS NULL OR project_id = $3)",
        )
        .bind(cutoff)
        .bind(project_id)
        .bind(project_id)
        .execute(&mut *tx)
        .await?;

        // Drop issues left with no events — no ghost shells (in-scope only).
        sqlx::query(
            "DELETE FROM issues WHERE ($1 IS NULL OR project_id = $2) \
             AND NOT EXISTS (SELECT 1 FROM events e WHERE e.issue_id = issues.id)",
        )
        .bind(project_id)
        .bind(project_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(counts)
    }

    /// Counts what a cleanup at `cutoff` would remove. Retention is keyed on
    /// `ingested_at` (server receipt time, not client-controlled). Spans are
    /// counted through their parent transaction since they cascade. An issue is
    /// "removed" when it has events but none survive the cutoff.
    async fn count_cleanup(
        pool: &DbPool,
        cutoff: chrono::DateTime<Utc>,
        project_id: Option<i32>,
    ) -> AppResult<CleanupCounts> {
        let (events, transactions, spans, issues_removed): (i64, i64, i64, i64) = sqlx::query_as(
            r#"
            SELECT
                (SELECT COUNT(*) FROM events e
                    WHERE e.ingested_at < $1 AND ($2 IS NULL OR e.project_id = $3)),
                (SELECT COUNT(*) FROM transactions t
                    WHERE t.ingested_at < $4 AND ($5 IS NULL OR t.project_id = $6)),
                (SELECT COUNT(*) FROM spans s
                    JOIN transactions t2 ON s.transaction_id = t2.id
                    WHERE t2.ingested_at < $7 AND ($8 IS NULL OR t2.project_id = $9)),
                (SELECT COUNT(*) FROM issues i
                    WHERE ($10 IS NULL OR i.project_id = $11)
                      AND EXISTS (SELECT 1 FROM events e2 WHERE e2.issue_id = i.id)
                      AND NOT EXISTS (
                          SELECT 1 FROM events e3 WHERE e3.issue_id = i.id AND e3.ingested_at >= $12
                      ))
            "#,
        )
        .bind(cutoff)
        .bind(project_id)
        .bind(project_id)
        .bind(cutoff)
        .bind(project_id)
        .bind(project_id)
        .bind(cutoff)
        .bind(project_id)
        .bind(project_id)
        .bind(project_id)
        .bind(project_id)
        .bind(cutoff)
        .fetch_one(pool)
        .await?;

        Ok(CleanupCounts {
            events,
            transactions,
            spans,
            issues_removed,
        })
    }

    /// Per-project storage breakdown (one row per project, including empty ones).
    ///
    /// Correlated `COUNT(*)` subqueries keep it dialect-portable; `estimated_bytes`
    /// sums the JSON payload lengths the project owns across events/transactions/spans
    /// (`length(CAST(data AS TEXT))` — char length, a stable cross-backend estimate).
    pub async fn by_project(pool: &DbPool) -> AppResult<Vec<ProjectStorage>> {
        let rows: Vec<(i32, String, i64, i64, i64, i64, i64)> = sqlx::query_as(
            r#"
            SELECT
                p.id,
                p.name,
                (SELECT COUNT(*) FROM events e        WHERE e.project_id = p.id) AS events_count,
                (SELECT COUNT(*) FROM transactions t  WHERE t.project_id = p.id) AS transactions_count,
                (SELECT COUNT(*) FROM spans s         WHERE s.project_id = p.id) AS spans_count,
                (SELECT COUNT(*) FROM source_file_metadata m WHERE m.project_id = p.id) AS source_maps_count,
                (
                    (SELECT COALESCE(SUM(length(CAST(e.data AS TEXT))), 0) FROM events e       WHERE e.project_id = p.id)
                  + (SELECT COALESCE(SUM(length(CAST(t.data AS TEXT))), 0) FROM transactions t WHERE t.project_id = p.id)
                  + (SELECT COALESCE(SUM(length(CAST(s.data AS TEXT))), 0) FROM spans s         WHERE s.project_id = p.id)
                ) AS estimated_bytes
            FROM projects p
            ORDER BY p.id
            "#,
        )
        .fetch_all(pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(
                |(
                    project_id,
                    project_name,
                    events_count,
                    transactions_count,
                    spans_count,
                    source_maps_count,
                    estimated_bytes,
                )| {
                    ProjectStorage {
                        project_id,
                        project_name,
                        events_count,
                        transactions_count,
                        spans_count,
                        source_maps_count,
                        estimated_bytes,
                    }
                },
            )
            .collect())
    }

    /// Instance-wide storage summary (row counts + DB size + source-map weight).
    pub async fn global_summary(pool: &DbPool) -> AppResult<StorageSummary> {
        let (events_count, transactions_count, spans_count): (i64, i64, i64) = sqlx::query_as(
            r#"
            SELECT
                (SELECT COUNT(*) FROM events)       AS events_count,
                (SELECT COUNT(*) FROM transactions) AS transactions_count,
                (SELECT COUNT(*) FROM spans)        AS spans_count
            "#,
        )
        .fetch_one(pool)
        .await?;

        Ok(StorageSummary {
            total_db_size_bytes: Self::db_size_bytes(pool).await?,
            events_count,
            transactions_count,
            spans_count,
            source_maps: Self::source_map_storage(pool).await?,
        })
    }

    /// Whole-database size in bytes, reported by the backend. Best-effort: it's a
    /// headline figure, not a per-row sum.
    #[cfg(feature = "postgres")]
    async fn db_size_bytes(pool: &DbPool) -> AppResult<i64> {
        let (size,): (i64,) = sqlx::query_as("SELECT pg_database_size(current_database())::BIGINT")
            .fetch_one(pool)
            .await?;
        Ok(size)
    }

    /// SQLite has no `pg_database_size`; the file size is `page_count * page_size`.
    #[cfg(feature = "sqlite")]
    async fn db_size_bytes(pool: &DbPool) -> AppResult<i64> {
        let page_count: i64 = sqlx::query_scalar("PRAGMA page_count")
            .fetch_one(pool)
            .await?;
        let page_size: i64 = sqlx::query_scalar("PRAGMA page_size")
            .fetch_one(pool)
            .await?;
        Ok(page_count * page_size)
    }

    /// Exact source-map storage weight, summed from `chunk.size` + `source_file.size`.
    ///
    /// Scalar subqueries + `COALESCE(SUM(...), 0)` keep it portable across Postgres
    /// and SQLite and well-defined on an empty database (zeros, never NULL).
    pub async fn source_map_storage(pool: &DbPool) -> AppResult<SourceMapStorage> {
        let (chunk_bytes, source_file_bytes, file_count): (i64, i64, i64) = sqlx::query_as(
            r#"
            SELECT
                (SELECT COALESCE(SUM(size), 0) FROM chunk)       AS chunk_bytes,
                (SELECT COALESCE(SUM(size), 0) FROM source_file) AS source_file_bytes,
                (SELECT COUNT(*) FROM source_file)               AS file_count
            "#,
        )
        .fetch_one(pool)
        .await?;

        Ok(SourceMapStorage {
            chunk_bytes,
            source_file_bytes,
            total_bytes: chunk_bytes + source_file_bytes,
            file_count,
        })
    }
}
