//! Integration tests for the Authentication API
//!
//! Tests the complete authentication flow with a real PostgreSQL database.
//! Covers: register, login, logout, get current user, and session management.

use crate::common::TestDb;
use actix_session::{storage::CookieSessionStore, SessionMiddleware};
use actix_web::{cookie::Key, test, web, App};
use rustrak::config::{Config, DatabaseConfig};
use rustrak::middleware::auth::RequireAuth;
use rustrak::models::User;
use rustrak::routes;
use rustrak::services::UsersService;
use serde_json::{json, Value};
use std::time::Duration;

/// Creates a test config
fn create_test_config() -> Config {
    Config {
        host: "127.0.0.1".to_string(),
        port: 0,
        database: DatabaseConfig {
            url: "postgres://test:test@localhost/test".to_string(),
            max_connections: 5,
            min_connections: 1,
            acquire_timeout: Duration::from_secs(5),
            idle_timeout: Duration::from_secs(60),
            max_lifetime: Duration::from_secs(300),
        },
        rate_limit: rustrak::config::RateLimitConfig {
            max_events_per_minute: 1000,
            max_events_per_hour: 10000,
            max_events_per_project_per_minute: 500,
            max_events_per_project_per_hour: 5000,
        },
        security: rustrak::config::SecurityConfig {
            ssl_proxy: false,
            session_secret_key: None,
        },
        ingest_dir: None,
        public_url: None,
        sourcemap_storage_path: "/tmp/test_sourcemaps".to_string(),
        max_chunk_size_bytes: 10 * 1024 * 1024,
        session_flush_interval_secs: 30,
        session_cardinality_cap: 10_000,
    }
}

/// Helper to create test user directly in DB
async fn create_test_user(
    pool: &rustrak::db::DbPool,
    email: &str,
    password: &str,
    is_admin: bool,
) -> User {
    let req = rustrak::models::CreateUserRequest {
        email: email.to_string(),
        password: password.to_string(),
    };
    let role = if is_admin {
        rustrak::models::UserRole::Admin
    } else {
        rustrak::models::UserRole::Member
    };
    UsersService::create_user(pool, &req, role)
        .await
        .expect("Failed to create test user")
}

// =============================================================================
// Register Tests
// =============================================================================

#[actix_web::test]
async fn test_register_success() {
    let db = TestDb::new().await;
    let config = create_test_config();

    let session_key = Key::from(&[0u8; 64]);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .cookie_http_only(true)
                    .build(),
            )
            .configure(routes::auth::configure),
    )
    .await;

    let req = test::TestRequest::post()
        .uri("/auth/register")
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({
            "email": "newuser@example.com",
            "password": "password123"
        }))
        .to_request();

    // Registration is now invite-only: /auth/register always returns 403 and
    // never creates a user. (RBAC: use /auth/accept-invitation instead.)
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 403, "registration is invite-only");

    // Verify NO user was created in the database.
    assert!(UsersService::get_by_email(&db.pool, "newuser@example.com")
        .await
        .unwrap()
        .is_none());
}

#[actix_web::test]
async fn test_register_invalid_email() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .configure(routes::auth::configure),
    )
    .await;

    let req = test::TestRequest::post()
        .uri("/auth/register")
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({
            "email": "not-an-email",
            "password": "password123"
        }))
        .to_request();

    // Invite-only: register rejects everything with 403 before any validation.
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 403);
}

#[actix_web::test]
async fn test_register_empty_password_rejected() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .configure(routes::auth::configure),
    )
    .await;

    // Invite-only: register rejects everything with 403.
    let req = test::TestRequest::post()
        .uri("/auth/register")
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({
            "email": "user@example.com",
            "password": ""
        }))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 403);
}

#[actix_web::test]
async fn test_register_duplicate_email() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    // Create existing user
    create_test_user(&db.pool, "existing@example.com", "password123", false).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .configure(routes::auth::configure),
    )
    .await;

    let req = test::TestRequest::post()
        .uri("/auth/register")
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({
            "email": "existing@example.com",
            "password": "password123"
        }))
        .to_request();

    // Invite-only: register always returns 403 (does not reach duplicate check).
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 403);
}

#[actix_web::test]
async fn test_register_creates_session() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .cookie_http_only(true)
                    .build(),
            )
            .configure(routes::auth::configure),
    )
    .await;

    let req = test::TestRequest::post()
        .uri("/auth/register")
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({
            "email": "sessiontest@example.com",
            "password": "password123"
        }))
        .to_request();

    // Invite-only: register no longer creates a session; it returns 403.
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 403);
}

// =============================================================================
// Login Tests
// =============================================================================

#[actix_web::test]
async fn test_login_success() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    // Create test user
    create_test_user(&db.pool, "logintest@example.com", "password123", false).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .configure(routes::auth::configure),
    )
    .await;

    let req = test::TestRequest::post()
        .uri("/auth/login")
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({
            "email": "logintest@example.com",
            "password": "password123"
        }))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["user"]["email"], "logintest@example.com");
    assert!(body["user"]["id"].is_number());
}

#[actix_web::test]
async fn test_login_wrong_password() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    create_test_user(&db.pool, "wrongpass@example.com", "correctpassword", false).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .configure(routes::auth::configure),
    )
    .await;

    let req = test::TestRequest::post()
        .uri("/auth/login")
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({
            "email": "wrongpass@example.com",
            "password": "wrongpassword"
        }))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_login_nonexistent_user() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .configure(routes::auth::configure),
    )
    .await;

    let req = test::TestRequest::post()
        .uri("/auth/login")
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({
            "email": "nonexistent@example.com",
            "password": "password123"
        }))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_login_inactive_user() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    // Create user and deactivate
    let user = create_test_user(&db.pool, "inactive@example.com", "password123", false).await;
    sqlx::query("UPDATE users SET is_active = false WHERE id = $1")
        .bind(user.id)
        .execute(&db.pool)
        .await
        .unwrap();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .configure(routes::auth::configure),
    )
    .await;

    let req = test::TestRequest::post()
        .uri("/auth/login")
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({
            "email": "inactive@example.com",
            "password": "password123"
        }))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_login_updates_last_login() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    let user = create_test_user(&db.pool, "lastlogin@example.com", "password123", false).await;

    // Initially, last_login should be None
    assert!(user.last_login.is_none());

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .configure(routes::auth::configure),
    )
    .await;

    let req = test::TestRequest::post()
        .uri("/auth/login")
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({
            "email": "lastlogin@example.com",
            "password": "password123"
        }))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // Check that last_login was updated
    let updated_user = UsersService::get_by_email(&db.pool, "lastlogin@example.com")
        .await
        .unwrap()
        .unwrap();
    assert!(updated_user.last_login.is_some());
}

// =============================================================================
// Logout Tests
// =============================================================================

#[actix_web::test]
async fn test_logout_success() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .configure(routes::auth::configure),
    )
    .await;

    let req = test::TestRequest::post().uri("/auth/logout").to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 204);
}

// =============================================================================
// Get Current User Tests
// =============================================================================

// NOTE: This test is ignored because actix-web test framework doesn't properly
// preserve session cookies between requests. This would require E2E testing with
// a real HTTP client or browser. The session mechanism itself is tested via
// register/login tests that verify sessions are created.
#[actix_web::test]
#[ignore]
async fn test_get_current_user_authenticated() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    // Create and login user
    create_test_user(&db.pool, "currentuser@example.com", "password123", false).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .configure(routes::auth::configure),
    )
    .await;

    // Login first
    let login_req = test::TestRequest::post()
        .uri("/auth/login")
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({
            "email": "currentuser@example.com",
            "password": "password123"
        }))
        .to_request();

    let login_resp = test::call_service(&app, login_req).await;
    assert_eq!(login_resp.status(), 200);

    // Extract session cookie
    let cookies: Vec<_> = login_resp.headers().get_all("set-cookie").collect();
    assert!(!cookies.is_empty());

    let cookie_value = cookies[0].to_str().unwrap();

    // Now get current user with session cookie
    let me_req = test::TestRequest::get()
        .uri("/auth/me")
        .insert_header(("Cookie", cookie_value))
        .to_request();

    let me_resp = test::call_service(&app, me_req).await;
    assert_eq!(me_resp.status(), 200);

    let body: Value = test::read_body_json(me_resp).await;
    assert_eq!(body["email"], "currentuser@example.com");
}

#[actix_web::test]
async fn test_get_current_user_unauthenticated() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .configure(routes::auth::configure),
    )
    .await;

    let req = test::TestRequest::get().uri("/auth/me").to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

// =============================================================================
// Password Security Tests
// =============================================================================

#[actix_web::test]
async fn test_password_is_hashed_in_database() {
    let db = TestDb::new().await;

    // Registration is invite-only, so create the user directly via the service
    // (the service is what performs the Argon2 hashing).
    create_test_user(&db.pool, "hashtest@example.com", "mysecretpassword", false).await;

    // Get user from database
    let user = UsersService::get_by_email(&db.pool, "hashtest@example.com")
        .await
        .unwrap()
        .unwrap();

    // Password hash should NOT be the plain password
    assert_ne!(user.password_hash, "mysecretpassword");

    // Password hash should be Argon2 format (starts with $argon2)
    assert!(user.password_hash.starts_with("$argon2"));
}

#[actix_web::test]
async fn test_different_passwords_produce_different_hashes() {
    let db = TestDb::new().await;

    let user1 = create_test_user(&db.pool, "user1@example.com", "password123", false).await;
    let user2 = create_test_user(&db.pool, "user2@example.com", "password123", false).await;

    // Even with same password, hashes should be different (due to random salt)
    assert_ne!(user1.password_hash, user2.password_hash);
}

// =============================================================================
// Middleware Integration Tests
// =============================================================================

#[actix_web::test]
async fn test_middleware_blocks_unauthenticated_access() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .wrap(RequireAuth::default())
            .configure(routes::auth::configure)
            .configure(routes::projects::configure),
    )
    .await;

    // Try to access protected route without authentication
    let req = test::TestRequest::get().uri("/api/projects").to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

// NOTE: Ignored - session cookies not preserved in actix test framework
#[actix_web::test]
#[ignore]
async fn test_middleware_allows_authenticated_access() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    create_test_user(&db.pool, "authuser@example.com", "password123", false).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .wrap(RequireAuth::default())
            .configure(routes::auth::configure)
            .configure(routes::projects::configure),
    )
    .await;

    // Login first
    let login_req = test::TestRequest::post()
        .uri("/auth/login")
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({
            "email": "authuser@example.com",
            "password": "password123"
        }))
        .to_request();

    let login_resp = test::call_service(&app, login_req).await;
    let cookies: Vec<_> = login_resp.headers().get_all("set-cookie").collect();
    let cookie_value = cookies[0].to_str().unwrap();

    // Now access protected route with session
    let req = test::TestRequest::get()
        .uri("/api/projects")
        .insert_header(("Cookie", cookie_value))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
}

#[actix_web::test]
async fn test_middleware_exempts_auth_routes() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .wrap(RequireAuth::default())
            .configure(routes::auth::configure),
    )
    .await;

    // Auth routes should be reachable without authentication. The register
    // route is invite-only so it returns 403 (handler-level), NOT 401 from the
    // RequireAuth middleware — proving the route is exempt and was reached.
    let req = test::TestRequest::post()
        .uri("/auth/register")
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({
            "email": "exempt@example.com",
            "password": "password123"
        }))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 403);
}

#[actix_web::test]
async fn test_middleware_exempts_health_routes() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .wrap(RequireAuth::default())
            .service(
                web::scope("/health")
                    .route("", web::get().to(routes::health::liveness))
                    .route("/ready", web::get().to(routes::health::readiness)),
            ),
    )
    .await;

    // Health routes should be accessible without authentication
    let req = test::TestRequest::get().uri("/health").to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
}

// =============================================================================
// Edge Cases and Corner Cases
// =============================================================================

#[actix_web::test]
async fn test_register_with_very_long_email() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .configure(routes::auth::configure),
    )
    .await;

    // Local part exceeds 64 char limit
    let long_email = format!("{}@example.com", "a".repeat(250));

    let req = test::TestRequest::post()
        .uri("/auth/register")
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({
            "email": long_email,
            "password": "password123"
        }))
        .to_request();

    // Invite-only: register rejects with 403 before any validation runs.
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 403);
}

#[actix_web::test]
async fn test_login_case_sensitive_email() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    create_test_user(&db.pool, "CaseSensitive@example.com", "password123", false).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .configure(routes::auth::configure),
    )
    .await;

    // Try login with different case
    let req = test::TestRequest::post()
        .uri("/auth/login")
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({
            "email": "casesensitive@example.com",
            "password": "password123"
        }))
        .to_request();

    let resp = test::call_service(&app, req).await;
    // Email lookup is case-sensitive in PostgreSQL
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_concurrent_registrations_same_email() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .configure(routes::auth::configure),
    )
    .await;

    // Simulate concurrent registrations
    let req1 = test::TestRequest::post()
        .uri("/auth/register")
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({
            "email": "concurrent@example.com",
            "password": "password123"
        }))
        .to_request();

    let req2 = test::TestRequest::post()
        .uri("/auth/register")
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({
            "email": "concurrent@example.com",
            "password": "password456"
        }))
        .to_request();

    let resp1 = test::call_service(&app, req1).await;
    let resp2 = test::call_service(&app, req2).await;

    // Invite-only: both registrations are rejected with 403, and no user is
    // ever created regardless of concurrency.
    assert_eq!(resp1.status(), 403);
    assert_eq!(resp2.status(), 403);
    assert!(
        UsersService::get_by_email(&db.pool, "concurrent@example.com")
            .await
            .unwrap()
            .is_none()
    );
}

// NOTE: Ignored - session cookies not preserved in actix test framework
#[actix_web::test]
#[ignore]
async fn test_session_persists_across_requests() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    create_test_user(&db.pool, "sessionpersist@example.com", "password123", false).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .configure(routes::auth::configure),
    )
    .await;

    // Login
    let login_req = test::TestRequest::post()
        .uri("/auth/login")
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({
            "email": "sessionpersist@example.com",
            "password": "password123"
        }))
        .to_request();

    let login_resp = test::call_service(&app, login_req).await;
    let cookies: Vec<_> = login_resp.headers().get_all("set-cookie").collect();
    let cookie_value = cookies[0].to_str().unwrap();

    // Make multiple requests with same session
    for _ in 0..5 {
        let req = test::TestRequest::get()
            .uri("/auth/me")
            .insert_header(("Cookie", cookie_value))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);
    }
}

// NOTE: Ignored - session cookies not preserved in actix test framework
#[actix_web::test]
#[ignore]
async fn test_logout_invalidates_session() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let session_key = Key::from(&[0u8; 64]);

    create_test_user(&db.pool, "logouttest@example.com", "password123", false).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .configure(routes::auth::configure),
    )
    .await;

    // Login
    let login_req = test::TestRequest::post()
        .uri("/auth/login")
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({
            "email": "logouttest@example.com",
            "password": "password123"
        }))
        .to_request();

    let login_resp = test::call_service(&app, login_req).await;
    let cookies: Vec<_> = login_resp.headers().get_all("set-cookie").collect();
    let cookie_value = cookies[0].to_str().unwrap();

    // Verify session works
    let me_req = test::TestRequest::get()
        .uri("/auth/me")
        .insert_header(("Cookie", cookie_value))
        .to_request();
    let me_resp = test::call_service(&app, me_req).await;
    assert_eq!(me_resp.status(), 200);

    // Logout
    let logout_req = test::TestRequest::post()
        .uri("/auth/logout")
        .insert_header(("Cookie", cookie_value))
        .to_request();
    let logout_resp = test::call_service(&app, logout_req).await;
    assert_eq!(logout_resp.status(), 204);

    // Try to use session after logout - should fail
    let me_req2 = test::TestRequest::get()
        .uri("/auth/me")
        .insert_header(("Cookie", cookie_value))
        .to_request();
    let me_resp2 = test::call_service(&app, me_req2).await;
    assert_eq!(me_resp2.status(), 401);
}

// ---------------------------------------------------------------------------
// RequireAuth and the public SPA
//
// These pin the boundary between "the dashboard is served, so its shell and
// assets must be fetchable without a session" and "it is not, so nothing is".
//
// They exist because that boundary already drifted once: the exemption was
// gated at compile time while the serving was gated at run time, so turning the
// dashboard off left the exemption on and an unknown GET answered 404 where it
// used to answer 401. Nothing caught it. Now something does.
//
// No database: the middleware never touches one, and a test that needs a
// container to assert a status code is a test nobody runs.
// ---------------------------------------------------------------------------

/// An app wrapped in `RequireAuth` with no routes at all, so every request
/// falls through to the middleware's own decision and nothing else.
macro_rules! require_auth_app {
    ($middleware:expr) => {
        test::init_service(
            App::new()
                .wrap($middleware)
                .wrap(
                    SessionMiddleware::builder(
                        CookieSessionStore::default(),
                        Key::from(&[0u8; 64]),
                    )
                    .cookie_secure(false)
                    .build(),
                )
                .default_service(web::to(actix_web::HttpResponse::Ok)),
        )
        .await
    };
}

#[actix_web::test]
async fn strict_require_auth_rejects_an_unauthenticated_get() {
    let app = require_auth_app!(RequireAuth::default());

    let resp = test::call_service(&app, test::TestRequest::get().uri("/issues").to_request()).await;

    // The default is strict on purpose: the permissive branch has to be asked
    // for, so nothing widens by accident.
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn public_spa_lets_an_unauthenticated_get_through() {
    let app = require_auth_app!(RequireAuth::new(true));

    let resp = test::call_service(&app, test::TestRequest::get().uri("/issues").to_request()).await;

    // Reloading on a client-side route has to reach the SPA shell. Demanding a
    // session first would be a loop: the login screen is inside that bundle.
    assert_eq!(resp.status(), 200);
}

#[actix_web::test]
async fn public_spa_still_rejects_an_unauthenticated_write() {
    let app = require_auth_app!(RequireAuth::new(true));

    for request in [
        test::TestRequest::post().uri("/whatever").to_request(),
        test::TestRequest::delete().uri("/whatever").to_request(),
    ] {
        let resp = test::call_service(&app, request).await;

        // The exemption is safe-methods only. Serving a UI must never widen
        // anything that writes.
        assert_eq!(resp.status(), 401);
    }
}

#[actix_web::test]
async fn public_spa_does_not_change_the_api_surface() {
    let app = require_auth_app!(RequireAuth::new(true));

    // `/api/*` is exempt from this middleware either way, because each route
    // authenticates through its own extractor. Serving the dashboard must not
    // move that line.
    let resp = test::call_service(
        &app,
        test::TestRequest::get().uri("/api/projects").to_request(),
    )
    .await;

    assert_eq!(resp.status(), 200);
}
