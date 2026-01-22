//! Database test utilities
//!
//! Provides helpers for setting up test databases with testcontainers.

use sqlx::PgPool;
use testcontainers::{runners::AsyncRunner, ContainerAsync};
use testcontainers_modules::postgres::Postgres;

/// A test database container with connection pool
pub struct TestDb {
    /// The running PostgreSQL container
    #[allow(dead_code)]
    container: ContainerAsync<Postgres>,
    /// Connection pool to the test database
    pub pool: PgPool,
}

impl TestDb {
    /// Creates a new test database with a fresh PostgreSQL container
    pub async fn new() -> Self {
        // Start PostgreSQL container
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

        // Create connection pool
        let pool = PgPool::connect(&database_url)
            .await
            .expect("Failed to connect to test database");

        // Enable pgcrypto extension for gen_random_uuid()
        sqlx::query("CREATE EXTENSION IF NOT EXISTS pgcrypto")
            .execute(&pool)
            .await
            .expect("Failed to enable pgcrypto extension");

        // Run migrations
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("Failed to run migrations");

        TestDb { container, pool }
    }
}
