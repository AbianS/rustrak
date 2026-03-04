use crate::config::DatabaseConfig;

#[cfg(feature = "postgres")]
use sqlx::postgres::{PgPool, PgPoolOptions};

#[cfg(feature = "sqlite")]
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};

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
        SqlitePoolOptions::new()
            .max_connections(config.max_connections)
            .min_connections(config.min_connections)
            .acquire_timeout(config.acquire_timeout)
            .idle_timeout(Some(config.idle_timeout))
            .max_lifetime(Some(config.max_lifetime))
            .connect(&config.url)
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
