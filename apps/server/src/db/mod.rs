#[cfg(all(feature = "postgres", feature = "sqlite"))]
compile_error!("Features \"postgres\" and \"sqlite\" are mutually exclusive. Enable only one.");

#[cfg(not(any(feature = "postgres", feature = "sqlite")))]
compile_error!("Either feature \"postgres\" or \"sqlite\" must be enabled.");

use crate::config::DatabaseConfig;

#[cfg(feature = "postgres")]
use sqlx::postgres::{PgPool, PgPoolOptions};

#[cfg(feature = "sqlite")]
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePool, SqlitePoolOptions};
#[cfg(feature = "sqlite")]
use std::str::FromStr;
#[cfg(feature = "sqlite")]
use std::time::Duration;

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
            .journal_mode(SqliteJournalMode::Wal)
            .busy_timeout(Duration::from_secs(5));
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
/// front. The default `BEGIN` is *deferred*: a transaction that reads before it
/// writes (as the digest does — `SELECT MAX(digest_order)` then `INSERT`) only
/// takes a read lock first, then tries to upgrade to a write lock. Under
/// concurrency that upgrade fails immediately with `SQLITE_BUSY_SNAPSHOT`
/// ("database is locked") and `busy_timeout` does *not* retry it. Taking the
/// write lock at `BEGIN` makes `busy_timeout` effective and serializes writers,
/// which also prevents duplicate `digest_order` values.
///
/// On PostgreSQL the default `BEGIN` is used (MVCC + advisory locks handle
/// concurrency; `IMMEDIATE` is not valid Postgres syntax).
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
