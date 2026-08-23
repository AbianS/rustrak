//! Database test utilities
//!
//! Provides helpers for setting up test databases.
//! - Postgres: uses testcontainers to spin up a real PostgreSQL container
//! - SQLite: uses an isolated file database cloned from a migrated template

use rustrak::db::DbPool;

#[cfg(feature = "sqlite")]
use std::sync::Arc;

#[cfg(feature = "sqlite")]
use tempfile::TempDir;

// ── Postgres ─────────────────────────────────────────────────────────────────

#[cfg(feature = "postgres")]
use testcontainers::{runners::AsyncRunner, ContainerAsync};
#[cfg(feature = "postgres")]
use testcontainers_modules::postgres::Postgres;

/// A test database with connection pool (Postgres variant includes a container)
#[cfg(feature = "postgres")]
#[allow(dead_code)]
pub struct TestDb {
    /// The running PostgreSQL container (kept alive for the duration of the test)
    #[allow(dead_code)]
    container: ContainerAsync<Postgres>,
    pub pool: DbPool,
}

#[cfg(feature = "postgres")]
impl TestDb {
    pub async fn new() -> Self {
        let container = Postgres::default()
            .start()
            .await
            .expect("Failed to start PostgreSQL container");

        let host = container.get_host().await.expect("Failed to get host");
        let port = container
            .get_host_port_ipv4(5432)
            .await
            .expect("Failed to get port");

        let database_url = format!("postgres://postgres:postgres@{}:{}/postgres", host, port);

        let pool = sqlx::postgres::PgPoolOptions::new()
            .connect(&database_url)
            .await
            .expect("Failed to connect to test database");

        // Enable pgcrypto extension (needed for some Postgres-specific functions)
        sqlx::query("CREATE EXTENSION IF NOT EXISTS pgcrypto")
            .execute(&pool)
            .await
            .expect("Failed to enable pgcrypto extension");

        sqlx::migrate!("./migrations/postgres")
            .run(&pool)
            .await
            .expect("Failed to run migrations");

        TestDb { container, pool }
    }
}

// ── SQLite ────────────────────────────────────────────────────────────────────

#[cfg(feature = "sqlite")]
pub struct TestDb {
    pub pool: DbPool,
    _directory: TempDir,
}

#[cfg(feature = "sqlite")]
impl TestDb {
    pub async fn new() -> Self {
        // Migrate one template once, then copy it for an isolated database.
        // This keeps parallel tests independent without paying migration setup
        // cost for every TestDb::new().
        static TEMPLATE: tokio::sync::OnceCell<Arc<TempDir>> = tokio::sync::OnceCell::const_new();
        let template = TEMPLATE
            .get_or_init(|| async {
                let directory =
                    tempfile::tempdir().expect("Failed to create SQLite template directory");
                let database_path = directory.path().join("template.sqlite");
                let pool = sqlx::sqlite::SqlitePoolOptions::new()
                    .max_connections(1)
                    .connect_with(
                        sqlx::sqlite::SqliteConnectOptions::new()
                            .filename(&database_path)
                            .create_if_missing(true),
                    )
                    .await
                    .expect("Failed to create SQLite template database");
                sqlx::migrate!("./migrations/sqlite")
                    .run(&pool)
                    .await
                    .expect("Failed to run SQLite migrations");
                pool.close().await;
                Arc::new(directory)
            })
            .await
            .clone();

        let directory = tempfile::tempdir().expect("Failed to create SQLite test directory");
        let database_path = directory.path().join("test.sqlite");
        std::fs::copy(template.path().join("template.sqlite"), &database_path)
            .expect("Failed to copy SQLite template database");

        // max_connections(1): SQLite only allows one writer at a time.
        // Using a single connection avoids SQLITE_LOCKED deadlocks when
        // multiple tokio tasks try to write concurrently in tests.
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(
                sqlx::sqlite::SqliteConnectOptions::new()
                    .filename(&database_path)
                    .create_if_missing(false),
            )
            .await
            .expect("Failed to open copied SQLite database");

        TestDb {
            pool,
            _directory: directory,
        }
    }
}
