#[cfg(all(feature = "postgres", feature = "sqlite"))]
compile_error!("Features \"postgres\" and \"sqlite\" are mutually exclusive. Enable only one.");

#[cfg(not(any(feature = "postgres", feature = "sqlite")))]
compile_error!("Either feature \"postgres\" or \"sqlite\" must be enabled.");

use crate::config::DatabaseConfig;

#[cfg(feature = "postgres")]
use sqlx::postgres::{PgPool, PgPoolOptions};

#[cfg(feature = "sqlite")]
use sqlx::sqlite::{
    SqliteConnectOptions, SqliteJournalMode, SqlitePool, SqlitePoolOptions, SqliteSynchronous,
};
#[cfg(feature = "sqlite")]
use std::str::FromStr;
#[cfg(feature = "sqlite")]
use std::time::Duration;

#[cfg(feature = "sqlite")]
/// How long a SQLite connection waits on the write lock before failing with
/// `SQLITE_BUSY`. This is the *whole* tolerance of every writer that is not
/// the digest (sourcemap assembly, the storage purge, bulk issue updates,
/// alert rules, the transaction/span/log processors): they get one shot at
/// the lock and no retry, so shortening it turns a slow holder into a 500.
/// 5s is the value SQLite's own guidance pairs with WAL.
const SQLITE_BUSY_TIMEOUT: Duration = Duration::from_secs(5);

/// The active SQLx database backend (selected by feature flag).
#[cfg(feature = "postgres")]
pub type Db = sqlx::Postgres;

#[cfg(feature = "sqlite")]
pub type Db = sqlx::Sqlite;

/// Type alias for the database connection pool
#[cfg(feature = "postgres")]
pub type DbPool = PgPool;

#[cfg(feature = "sqlite")]
pub type DbPool = SqlitePool;

/// Creates a new database connection pool with the provided configuration
pub async fn create_pool(config: &DatabaseConfig) -> Result<DbPool, sqlx::Error> {
    log::info!("Connecting to database...");

    #[cfg(feature = "postgres")]
    let pool = {
        PgPoolOptions::new()
            .max_connections(config.max_connections)
            .min_connections(config.min_connections)
            .acquire_timeout(config.acquire_timeout)
            .idle_timeout(Some(config.idle_timeout))
            .max_lifetime(Some(config.max_lifetime))
            .after_connect(|conn, _meta| {
                Box::pin(async move {
                    sqlx::query("SET timezone = 'UTC'").execute(conn).await?;
                    Ok(())
                })
            })
            .connect(&config.url)
            .await?
    };

    #[cfg(feature = "sqlite")]
    let pool = {
        let is_in_memory = config.url.ends_with(":memory:") || config.url.contains("mode=memory");
        let opts = SqliteConnectOptions::from_str(&config.url)
            .map_err(|e| sqlx::Error::Configuration(e.into()))?
            .create_if_missing(true)
            // WAL + NORMAL is SQLite's own recommended pairing: the per-commit
            // WAL fsync is dropped, so write-lock holds get shorter. Commits
            // stay atomic and survive an application crash; only an OS crash
            // or power loss can roll back the newest ones, which is the right
            // trade for a stream of error events. Documented for operators in
            // apps/docs/content/configuration/database.mdx.
            .journal_mode(SqliteJournalMode::Wal)
            .synchronous(SqliteSynchronous::Normal)
            .busy_timeout(SQLITE_BUSY_TIMEOUT);
        let max_connections = if is_in_memory {
            1
        } else {
            config.max_connections
        };
        let min_connections = if is_in_memory {
            1
        } else {
            config.min_connections
        };
        SqlitePoolOptions::new()
            .max_connections(max_connections)
            .min_connections(min_connections)
            .acquire_timeout(config.acquire_timeout)
            .idle_timeout(Some(config.idle_timeout))
            .max_lifetime(Some(config.max_lifetime))
            .connect_with(opts)
            .await?
    };

    log::info!(
        "Database connection pool established (max: {}, min: {})",
        config.max_connections,
        config.min_connections
    );

    Ok(pool)
}

/// Begins a transaction intended for writes.
///
/// On SQLite this issues `BEGIN IMMEDIATE` so the write lock is acquired up
/// front. A read-then-write transaction (the digest's
/// `SELECT MAX(digest_order)` → `INSERT`) must take the write lock at
/// `BEGIN`: a deferred `BEGIN` fails the read→write upgrade with
/// `SQLITE_BUSY_SNAPSHOT`, which `busy_timeout` does not retry. Taking
/// the lock up front also prevents duplicate `digest_order` values.
///
/// On PostgreSQL the default `BEGIN` is used (MVCC + advisory locks handle
/// concurrency; `IMMEDIATE` is not valid Postgres syntax).
///
/// Use ONLY for read-then-write transactions (a SELECT before the first
/// write). Write-first txs must keep a plain `pool.begin()`: IMMEDIATE
/// would hold the write lock across disk I/O and long loops for no benefit
/// — those sites carry a comment saying so.
pub async fn begin_write(pool: &DbPool) -> Result<sqlx::Transaction<'_, Db>, sqlx::Error> {
    #[cfg(feature = "sqlite")]
    {
        pool.begin_with("BEGIN IMMEDIATE").await
    }
    #[cfg(feature = "postgres")]
    {
        pool.begin().await
    }
}

/// Runs all pending database migrations
pub async fn run_migrations(pool: &DbPool) -> Result<(), sqlx::migrate::MigrateError> {
    log::info!("Running database migrations...");

    #[cfg(feature = "postgres")]
    sqlx::migrate!("./migrations/postgres").run(pool).await?;

    #[cfg(feature = "sqlite")]
    sqlx::migrate!("./migrations/sqlite").run(pool).await?;

    log::info!("Database migrations completed successfully");
    Ok(())
}

/// Performs a health check on the database connection
pub async fn health_check(pool: &DbPool) -> bool {
    sqlx::query("SELECT 1").execute(pool).await.is_ok()
}

/// Runs a full SQLite WAL checkpoint and reports whether it completed.
#[cfg(feature = "sqlite")]
pub async fn checkpoint_full(pool: &DbPool) -> Result<bool, sqlx::Error> {
    let busy: i64 = sqlx::query_scalar("PRAGMA wal_checkpoint(FULL)")
        .fetch_one(pool)
        .await?;
    Ok(busy == 0)
}

/// Decides whether a caller still needs its own WAL checkpoint.
///
/// A commit is durably in the main database file once any `FULL` checkpoint
/// that *started* after the commit completes. Tracking the start instant of
/// the last completed checkpoint lets concurrent digests coalesce: whoever
/// runs the checkpoint covers everyone whose commit (entry instant) preceded
/// its start.
#[derive(Default)]
pub struct CheckpointGate {
    last_completed_start: Option<std::time::Instant>,
}

impl CheckpointGate {
    /// Whether a completed checkpoint already covers a caller that entered at
    /// `entered` (i.e. whose commit predates that instant).
    pub fn covers(&self, entered: std::time::Instant) -> bool {
        self.last_completed_start
            .is_some_and(|started| started >= entered)
    }

    /// Records a successfully completed checkpoint by its start instant.
    pub fn record_completed(&mut self, started: std::time::Instant) {
        self.last_completed_start = Some(started);
    }
}

/// Runs a `FULL` checkpoint unless one already covers this caller's commit.
///
/// Callers that pile up behind an in-flight checkpoint coalesce: the first
/// waiter's own checkpoint (started after every waiter entered) covers the
/// rest, so N concurrent digests cost at most two checkpoints instead of N.
#[cfg(feature = "sqlite")]
pub async fn ensure_checkpointed(
    pool: &DbPool,
    gate: &tokio::sync::Mutex<CheckpointGate>,
) -> Result<bool, sqlx::Error> {
    let entered = std::time::Instant::now();
    let mut gate = gate.lock().await;
    if gate.covers(entered) {
        return Ok(true);
    }
    let started = std::time::Instant::now();
    let completed = checkpoint_full(pool).await?;
    if completed {
        gate.record_completed(started);
    }
    Ok(completed)
}

#[cfg(test)]
mod checkpoint_gate_tests {
    use super::CheckpointGate;
    use std::time::{Duration, Instant};

    #[test]
    fn skips_when_a_checkpoint_started_after_entry_has_completed() {
        let mut gate = CheckpointGate::default();
        let entered = Instant::now();
        gate.record_completed(entered + Duration::from_millis(1));
        assert!(
            gate.covers(entered),
            "a checkpoint that started after this caller entered covers its commit"
        );
    }

    #[test]
    fn does_not_skip_when_last_checkpoint_started_before_entry() {
        let mut gate = CheckpointGate::default();
        let started = Instant::now();
        gate.record_completed(started);
        assert!(
            !gate.covers(started + Duration::from_millis(1)),
            "a checkpoint that started before this caller entered may miss its frames"
        );
    }

    #[test]
    fn does_not_skip_when_no_checkpoint_has_completed() {
        let gate = CheckpointGate::default();
        assert!(!gate.covers(Instant::now()));
    }
}
