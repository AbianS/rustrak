//! Integration tests for Health endpoints
//!
//! Tests the liveness and readiness health check endpoints.

use actix_web::{test, web, App};
use rustrak::routes;
use serde_json::Value;
use sqlx::PgPool;
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

// =============================================================================
// Liveness Endpoint Tests
// =============================================================================

#[actix_web::test]
async fn test_liveness_returns_ok() {
    let db = TestDb::new().await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .service(
                web::scope("/health")
                    .route("", web::get().to(routes::health::liveness))
                    .route("/ready", web::get().to(routes::health::readiness)),
            ),
    )
    .await;

    let req = test::TestRequest::get().uri("/health").to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_liveness_returns_correct_content_type() {
    let db = TestDb::new().await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .service(web::scope("/health").route("", web::get().to(routes::health::liveness))),
    )
    .await;

    let req = test::TestRequest::get().uri("/health").to_request();

    let resp = test::call_service(&app, req).await;
    let content_type = resp
        .headers()
        .get("content-type")
        .expect("Content-Type header missing");
    assert!(content_type.to_str().unwrap().contains("application/json"));
}

#[actix_web::test]
async fn test_liveness_does_not_require_auth() {
    let db = TestDb::new().await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .service(web::scope("/health").route("", web::get().to(routes::health::liveness))),
    )
    .await;

    // No auth header provided
    let req = test::TestRequest::get().uri("/health").to_request();

    let resp = test::call_service(&app, req).await;
    // Should succeed without auth
    assert!(resp.status().is_success());
}

// =============================================================================
// Readiness Endpoint Tests
// =============================================================================

#[actix_web::test]
async fn test_readiness_returns_ready_with_healthy_db() {
    let db = TestDb::new().await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .service(
                web::scope("/health").route("/ready", web::get().to(routes::health::readiness)),
            ),
    )
    .await;

    let req = test::TestRequest::get().uri("/health/ready").to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ready");
    assert_eq!(body["checks"]["database"], "ok");
}

#[actix_web::test]
async fn test_readiness_returns_not_ready_with_closed_pool() {
    let db = TestDb::new().await;

    // Close the pool to simulate unhealthy database
    db.pool.close().await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .service(
                web::scope("/health").route("/ready", web::get().to(routes::health::readiness)),
            ),
    )
    .await;

    let req = test::TestRequest::get().uri("/health/ready").to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 503);

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "not_ready");
    assert_eq!(body["checks"]["database"], "error");
}

#[actix_web::test]
async fn test_readiness_does_not_require_auth() {
    let db = TestDb::new().await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .service(
                web::scope("/health").route("/ready", web::get().to(routes::health::readiness)),
            ),
    )
    .await;

    // No auth header provided
    let req = test::TestRequest::get().uri("/health/ready").to_request();

    let resp = test::call_service(&app, req).await;
    // Should succeed without auth
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_readiness_returns_correct_content_type() {
    let db = TestDb::new().await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .service(
                web::scope("/health").route("/ready", web::get().to(routes::health::readiness)),
            ),
    )
    .await;

    let req = test::TestRequest::get().uri("/health/ready").to_request();

    let resp = test::call_service(&app, req).await;
    let content_type = resp
        .headers()
        .get("content-type")
        .expect("Content-Type header missing");
    assert!(content_type.to_str().unwrap().contains("application/json"));
}

// =============================================================================
// Edge Cases and Error Handling
// =============================================================================

#[actix_web::test]
async fn test_health_post_returns_error() {
    let db = TestDb::new().await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .service(web::scope("/health").route("", web::get().to(routes::health::liveness))),
    )
    .await;

    let req = test::TestRequest::post().uri("/health").to_request();

    let resp = test::call_service(&app, req).await;
    // Actix-web returns 404 when no route matches the method
    assert!(resp.status().is_client_error());
}

#[actix_web::test]
async fn test_readiness_post_returns_error() {
    let db = TestDb::new().await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .service(
                web::scope("/health").route("/ready", web::get().to(routes::health::readiness)),
            ),
    )
    .await;

    let req = test::TestRequest::post().uri("/health/ready").to_request();

    let resp = test::call_service(&app, req).await;
    // Actix-web returns 404 when no route matches the method
    assert!(resp.status().is_client_error());
}
