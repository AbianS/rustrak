#[cfg(all(feature = "postgres", feature = "sqlite"))]
compile_error!("Features \"postgres\" and \"sqlite\" are mutually exclusive. Enable only one.");

#[cfg(not(any(feature = "postgres", feature = "sqlite")))]
compile_error!("Either feature \"postgres\" or \"sqlite\" must be enabled.");

use crate::config::DatabaseConfig;

#[cfg(feature = "postgres")]
use sqlx::postgres::{PgPool, PgPoolOptions};

#[cfg(feature = "sqlite")]
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
#[cfg(feature = "sqlite")]
use std::str::FromStr;

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
            .create_if_missing(true);
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
