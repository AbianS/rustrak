//! Integration tests for Bootstrap functionality
//!
//! Tests the CREATE_SUPERUSER bootstrap mechanism

use rustrak::bootstrap;
use rustrak::services::UsersService;
use sqlx::PgPool;
use std::env;
use testcontainers::{runners::AsyncRunner, ContainerAsync};
use testcontainers_modules::postgres::Postgres;

/// Test database container with connection pool
struct TestDb {
    #[allow(dead_code)]
    container: ContainerAsync<Postgres>,
    pool: PgPool,
}

impl TestDb {
    async fn new() -> Self {
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

        let pool = PgPool::connect(&database_url)
            .await
            .expect("Failed to connect to test database");

        // Enable pgcrypto extension for gen_random_uuid()
        sqlx::query("CREATE EXTENSION IF NOT EXISTS pgcrypto")
            .execute(&pool)
            .await
            .expect("Failed to enable pgcrypto extension");

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("Failed to run migrations");

        TestDb { container, pool }
    }
}

#[tokio::test]
async fn test_bootstrap_creates_superuser_when_empty() {
    let db = TestDb::new().await;

    // Set CREATE_SUPERUSER environment variable
    env::set_var("CREATE_SUPERUSER", "admin@example.com:password123");

    // Run bootstrap
    let result = bootstrap::create_superuser_if_needed(&db.pool).await;
    assert!(result.is_ok());

    // Verify user was created
    let user = UsersService::get_by_email(&db.pool, "admin@example.com")
        .await
        .unwrap()
        .unwrap();

    assert_eq!(user.email, "admin@example.com");
    assert!(user.is_admin);
    assert!(user.is_active);

    // Clean up
    env::remove_var("CREATE_SUPERUSER");
}

#[tokio::test]
async fn test_bootstrap_skips_when_users_exist() {
    let db = TestDb::new().await;

    // Create an existing user
    let req = rustrak::models::CreateUserRequest {
        email: "existing@example.com".to_string(),
        password: "password123".to_string(),
    };
    UsersService::create_user(&db.pool, &req, false)
        .await
        .unwrap();

    // Set CREATE_SUPERUSER environment variable
    env::set_var("CREATE_SUPERUSER", "admin@example.com:password123");

    // Run bootstrap - should skip
    let result = bootstrap::create_superuser_if_needed(&db.pool).await;
    assert!(result.is_ok());

    // Verify admin was NOT created
    let admin = UsersService::get_by_email(&db.pool, "admin@example.com")
        .await
        .unwrap();
    assert!(admin.is_none());

    // Clean up
    env::remove_var("CREATE_SUPERUSER");
}

#[tokio::test]
async fn test_bootstrap_skips_when_env_not_set() {
    let db = TestDb::new().await;

    // Ensure CREATE_SUPERUSER is not set
    env::remove_var("CREATE_SUPERUSER");

    // Run bootstrap
    let result = bootstrap::create_superuser_if_needed(&db.pool).await;
    assert!(result.is_ok());

    // Verify no users were created
    let count = UsersService::user_count(&db.pool).await.unwrap();
    assert_eq!(count, 0);
}

#[tokio::test]
async fn test_bootstrap_fails_with_invalid_format() {
    let db = TestDb::new().await;

    // Invalid format (missing colon)
    env::set_var("CREATE_SUPERUSER", "admin@example.com");

    let result = bootstrap::create_superuser_if_needed(&db.pool).await;
    assert!(result.is_err());

    // Clean up
    env::remove_var("CREATE_SUPERUSER");
}

#[tokio::test]
async fn test_bootstrap_fails_with_empty_password() {
    let db = TestDb::new().await;

    // Empty password should be rejected
    env::set_var("CREATE_SUPERUSER", "admin@example.com:");

    let result = bootstrap::create_superuser_if_needed(&db.pool).await;
    assert!(result.is_err());

    // Verify no user was created
    let count = UsersService::user_count(&db.pool).await.unwrap();
    assert_eq!(count, 0);

    // Clean up
    env::remove_var("CREATE_SUPERUSER");
}

#[tokio::test]
async fn test_bootstrap_with_empty_string() {
    let db = TestDb::new().await;

    // Empty string
    env::set_var("CREATE_SUPERUSER", "");

    let result = bootstrap::create_superuser_if_needed(&db.pool).await;
    assert!(result.is_ok());

    // Verify no users were created
    let count = UsersService::user_count(&db.pool).await.unwrap();
    assert_eq!(count, 0);

    // Clean up
    env::remove_var("CREATE_SUPERUSER");
}

#[tokio::test]
async fn test_bootstrap_creates_admin_user() {
    let db = TestDb::new().await;

    env::set_var(
        "CREATE_SUPERUSER",
        "superadmin@example.com:superpassword123",
    );

    let result = bootstrap::create_superuser_if_needed(&db.pool).await;
    assert!(result.is_ok());

    let user = UsersService::get_by_email(&db.pool, "superadmin@example.com")
        .await
        .unwrap()
        .unwrap();

    // Verify it's an admin user
    assert!(user.is_admin);

    // Clean up
    env::remove_var("CREATE_SUPERUSER");
}

#[tokio::test]
async fn test_bootstrap_password_is_hashed() {
    let db = TestDb::new().await;

    env::set_var("CREATE_SUPERUSER", "hashcheck@example.com:testpassword123");

    let result = bootstrap::create_superuser_if_needed(&db.pool).await;
    assert!(result.is_ok());

    let user = UsersService::get_by_email(&db.pool, "hashcheck@example.com")
        .await
        .unwrap()
        .unwrap();

    // Password should be hashed, not plain text
    assert_ne!(user.password_hash, "testpassword123");
    assert!(user.password_hash.starts_with("$argon2"));

    // Verify password can be verified
    assert!(user.verify_password("testpassword123").unwrap());

    // Clean up
    env::remove_var("CREATE_SUPERUSER");
}

#[tokio::test]
async fn test_bootstrap_with_email_containing_colon() {
    let db = TestDb::new().await;

    // Email with colon in local part is invalid according to our email regex constraint
    // This tests splitn behavior - splits on first colon
    env::set_var("CREATE_SUPERUSER", "test:email@example.com:password123");

    let result = bootstrap::create_superuser_if_needed(&db.pool).await;

    // Should fail because email doesn't match regex constraint
    assert!(result.is_err());

    // Clean up
    env::remove_var("CREATE_SUPERUSER");
}

#[tokio::test]
async fn test_bootstrap_idempotent_across_restarts() {
    let db = TestDb::new().await;

    env::set_var("CREATE_SUPERUSER", "restart@example.com:password123");

    // First "startup"
    let result1 = bootstrap::create_superuser_if_needed(&db.pool).await;
    assert!(result1.is_ok());

    let user1 = UsersService::get_by_email(&db.pool, "restart@example.com")
        .await
        .unwrap()
        .unwrap();

    // Second "startup" - should skip
    let result2 = bootstrap::create_superuser_if_needed(&db.pool).await;
    assert!(result2.is_ok());

    // Verify no duplicate was created
    let count = UsersService::user_count(&db.pool).await.unwrap();
    assert_eq!(count, 1);

    let user2 = UsersService::get_by_email(&db.pool, "restart@example.com")
        .await
        .unwrap()
        .unwrap();

    // Same user ID confirms no duplicate
    assert_eq!(user1.id, user2.id);

    // Clean up
    env::remove_var("CREATE_SUPERUSER");
}

#[tokio::test]
async fn test_bootstrap_with_whitespace_in_email() {
    let db = TestDb::new().await;

    // Email with surrounding whitespace
    env::set_var("CREATE_SUPERUSER", "  whitespace@example.com  :password123");

    let result = bootstrap::create_superuser_if_needed(&db.pool).await;
    assert!(result.is_ok());

    // Email should be trimmed
    let user = UsersService::get_by_email(&db.pool, "whitespace@example.com")
        .await
        .unwrap()
        .unwrap();

    assert_eq!(user.email, "whitespace@example.com");

    // Clean up
    env::remove_var("CREATE_SUPERUSER");
}
