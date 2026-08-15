//! Database test utilities
//!
//! Provides helpers for setting up test databases.
//! - Postgres: uses testcontainers to spin up a real PostgreSQL container
//! - SQLite: uses an in-memory database (no container needed)

use rustrak::db::DbPool;

// ── Postgres ─────────────────────────────────────────────────────────────────

#[cfg(feature = "postgres")]
use testcontainers::{runners::AsyncRunner, ContainerAsync, ImageExt};
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
        // testcontainers-modules 0.15 still defaults to postgres:11-alpine
        // (EOL since Nov 2023); pin the current major instead — every major
        // release brings real performance gains for the container-heavy
        // suites, and a pinned tag keeps runs reproducible (floating
        // `latest` would silently move when the next major drops).
        let container = Postgres::default()
            .with_tag("18-alpine")
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
}

#[cfg(feature = "sqlite")]
impl TestDb {
    pub async fn new() -> Self {
        // max_connections(1): SQLite only allows one writer at a time.
        // Using a single connection avoids SQLITE_LOCKED deadlocks when
        // multiple tokio tasks try to write concurrently in tests.
        // Each TestDb::new() gets its own private in-memory database.
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("Failed to create in-memory SQLite database");

        sqlx::migrate!("./migrations/sqlite")
            .run(&pool)
            .await
            .expect("Failed to run SQLite migrations");

        TestDb { pool }
    }
}
