//! Integration tests for the Ingest API
//!
//! Tests event ingestion via the Sentry-compatible envelope endpoint.

use crate::common::TestDb;
use actix_web::{test, web, App};
use rustrak::config::{Config, DatabaseConfig, RateLimitConfig};
use rustrak::routes;
use rustrak::services::ProjectService;
use serde_json::{json, Value};
use std::time::Duration;
use uuid::Uuid;

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
        rate_limit: RateLimitConfig {
            max_events_per_minute: 1000,
            max_events_per_hour: 10000,
            max_events_per_project_per_minute: 500,
            max_events_per_project_per_hour: 5000,
        },
        security: rustrak::config::SecurityConfig {
            ssl_proxy: false,
            session_secret_key: None,
        },
        ingest_dir: Some("/tmp/rustrak_test_ingest".to_string()),
    }
}

/// Creates a test project and returns its sentry_key
async fn create_test_project(pool: &rustrak::db::DbPool, name: &str) -> (i32, String) {
    let project = ProjectService::create(
        pool,
        rustrak::models::CreateProject {
            name: name.to_string(),
            slug: None,
        },
    )
    .await
    .expect("Failed to create test project");
    (project.id, project.sentry_key.to_string())
}

/// Creates a minimal valid Sentry envelope
fn create_envelope(event_id: &str, event_json: &str) -> Vec<u8> {
    let envelope = format!(
        r#"{{"event_id":"{}"}}
{{"type":"event","length":{}}}
{}"#,
        event_id,
        event_json.len(),
        event_json
    );
    envelope.into_bytes()
}

// =============================================================================
// Basic Ingestion Tests
// =============================================================================

#[actix_web::test]
async fn test_ingest_basic_event() {
    let db = TestDb::new().await;
    let (project_id, sentry_key) = create_test_project(&db.pool, "Test Project").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::ingest::configure),
    )
    .await;

    let event_id = Uuid::new_v4().to_string().replace("-", "");
    let event_json = json!({
        "event_id": event_id,
        "timestamp": 1704801600.0,
        "level": "error",
        "platform": "python",
        "exception": {
            "values": [{
                "type": "ValueError",
                "value": "Invalid input"
            }]
        }
    })
    .to_string();

    let envelope = create_envelope(&event_id, &event_json);

    let req = test::TestRequest::post()
        .uri(&format!("/api/{}/envelope/", project_id))
        .insert_header((
            "X-Sentry-Auth",
            format!("Sentry sentry_key={}, sentry_version=7", sentry_key),
        ))
        .insert_header(("Content-Type", "application/x-sentry-envelope"))
        .set_payload(envelope)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["id"], event_id);
}

#[actix_web::test]
async fn test_ingest_with_query_param_auth() {
    let db = TestDb::new().await;
    let (project_id, sentry_key) = create_test_project(&db.pool, "Query Auth Project").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::ingest::configure),
    )
    .await;

    let event_id = Uuid::new_v4().to_string().replace("-", "");
    let event_json = json!({
        "event_id": event_id,
        "level": "error"
    })
    .to_string();

    let envelope = create_envelope(&event_id, &event_json);

    // Use query parameter for auth instead of header
    let req = test::TestRequest::post()
        .uri(&format!(
            "/api/{}/envelope/?sentry_key={}",
            project_id, sentry_key
        ))
        .insert_header(("Content-Type", "application/x-sentry-envelope"))
        .set_payload(envelope)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

// =============================================================================
// Authentication Error Tests
// =============================================================================

#[actix_web::test]
async fn test_ingest_missing_auth() {
    let db = TestDb::new().await;
    let (project_id, _) = create_test_project(&db.pool, "No Auth Project").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::ingest::configure),
    )
    .await;

    let event_id = Uuid::new_v4().to_string().replace("-", "");
    let event_json = json!({"event_id": event_id}).to_string();
    let envelope = create_envelope(&event_id, &event_json);

    let req = test::TestRequest::post()
        .uri(&format!("/api/{}/envelope/", project_id))
        .insert_header(("Content-Type", "application/x-sentry-envelope"))
        .set_payload(envelope)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_ingest_invalid_sentry_key() {
    let db = TestDb::new().await;
    let (project_id, _) = create_test_project(&db.pool, "Invalid Key Project").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::ingest::configure),
    )
    .await;

    let event_id = Uuid::new_v4().to_string().replace("-", "");
    let event_json = json!({"event_id": event_id}).to_string();
    let envelope = create_envelope(&event_id, &event_json);

    let req = test::TestRequest::post()
        .uri(&format!("/api/{}/envelope/", project_id))
        .insert_header((
            "X-Sentry-Auth",
            "Sentry sentry_key=00000000-0000-0000-0000-000000000000, sentry_version=7",
        ))
        .set_payload(envelope)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_ingest_wrong_project_id() {
    let db = TestDb::new().await;
    let (_, sentry_key) = create_test_project(&db.pool, "Wrong ID Project").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::ingest::configure),
    )
    .await;

    let event_id = Uuid::new_v4().to_string().replace("-", "");
    let event_json = json!({"event_id": event_id}).to_string();
    let envelope = create_envelope(&event_id, &event_json);

    // Use wrong project_id (99999) - project doesn't exist
    let req = test::TestRequest::post()
        .uri("/api/99999/envelope/")
        .insert_header((
            "X-Sentry-Auth",
            format!("Sentry sentry_key={}, sentry_version=7", sentry_key),
        ))
        .set_payload(envelope)
        .to_request();

    let resp = test::call_service(&app, req).await;
    // Project doesn't exist, so auth fails - could be 401 or 404 depending on implementation
    // Our auth checks project_id + sentry_key together, so it returns 404 when project not found
    assert!(resp.status() == 401 || resp.status() == 404);
}

// =============================================================================
// Envelope Validation Tests
// =============================================================================

#[actix_web::test]
async fn test_ingest_missing_event_id() {
    let db = TestDb::new().await;
    let (project_id, sentry_key) = create_test_project(&db.pool, "Missing Event ID").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::ingest::configure),
    )
    .await;

    // Envelope without event_id in headers
    let envelope = br#"{}
{"type":"event","length":2}
{}"#;

    let req = test::TestRequest::post()
        .uri(&format!("/api/{}/envelope/", project_id))
        .insert_header((
            "X-Sentry-Auth",
            format!("Sentry sentry_key={}, sentry_version=7", sentry_key),
        ))
        .set_payload(envelope.to_vec())
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);
}

#[actix_web::test]
async fn test_ingest_invalid_event_id_format() {
    let db = TestDb::new().await;
    let (project_id, sentry_key) = create_test_project(&db.pool, "Invalid Event ID").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::ingest::configure),
    )
    .await;

    // Envelope with invalid event_id (not a UUID)
    let envelope = br#"{"event_id":"not-a-uuid"}
{"type":"event","length":2}
{}"#;

    let req = test::TestRequest::post()
        .uri(&format!("/api/{}/envelope/", project_id))
        .insert_header((
            "X-Sentry-Auth",
            format!("Sentry sentry_key={}, sentry_version=7", sentry_key),
        ))
        .set_payload(envelope.to_vec())
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);
}

#[actix_web::test]
async fn test_ingest_invalid_json_payload() {
    let db = TestDb::new().await;
    let (project_id, sentry_key) = create_test_project(&db.pool, "Invalid JSON").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::ingest::configure),
    )
    .await;

    let event_id = Uuid::new_v4().to_string().replace("-", "");
    // Invalid JSON payload
    let envelope = format!(
        r#"{{"event_id":"{}"}}
{{"type":"event","length":12}}
not valid json"#,
        event_id
    );

    let req = test::TestRequest::post()
        .uri(&format!("/api/{}/envelope/", project_id))
        .insert_header((
            "X-Sentry-Auth",
            format!("Sentry sentry_key={}, sentry_version=7", sentry_key),
        ))
        .set_payload(envelope.into_bytes())
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);
}

// =============================================================================
// Special Cases Tests
// =============================================================================

#[actix_web::test]
async fn test_ingest_envelope_without_event_item() {
    let db = TestDb::new().await;
    let (project_id, sentry_key) = create_test_project(&db.pool, "No Event Item").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::ingest::configure),
    )
    .await;

    let event_id = Uuid::new_v4().to_string().replace("-", "");
    // Envelope with only session item, no event
    let envelope = format!(
        r#"{{"event_id":"{}"}}
{{"type":"session","length":2}}
{{}}"#,
        event_id
    );

    let req = test::TestRequest::post()
        .uri(&format!("/api/{}/envelope/", project_id))
        .insert_header((
            "X-Sentry-Auth",
            format!("Sentry sentry_key={}, sentry_version=7", sentry_key),
        ))
        .set_payload(envelope.into_bytes())
        .to_request();

    let resp = test::call_service(&app, req).await;
    // Should still return 200, but with no event stored
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["id"], event_id);
}

#[actix_web::test]
async fn test_ingest_empty_body() {
    let db = TestDb::new().await;
    let (project_id, sentry_key) = create_test_project(&db.pool, "Empty Body").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::ingest::configure),
    )
    .await;

    let req = test::TestRequest::post()
        .uri(&format!("/api/{}/envelope/", project_id))
        .insert_header((
            "X-Sentry-Auth",
            format!("Sentry sentry_key={}, sentry_version=7", sentry_key),
        ))
        .set_payload(Vec::new())
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);
}

// =============================================================================
// CORS Tests
// =============================================================================

#[actix_web::test]
async fn test_ingest_cors_preflight() {
    let db = TestDb::new().await;
    let (project_id, _) = create_test_project(&db.pool, "CORS Project").await;
    let config = create_test_config();

    // CORS is handled by middleware, so we need to include it in the test
    let cors = actix_cors::Cors::default()
        .allow_any_origin()
        .allowed_methods(vec!["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
        .allowed_headers(vec![
            actix_web::http::header::AUTHORIZATION,
            actix_web::http::header::ACCEPT,
            actix_web::http::header::CONTENT_TYPE,
            actix_web::http::header::CONTENT_ENCODING,
            actix_web::http::header::HeaderName::from_static("x-sentry-auth"),
        ])
        .max_age(3600);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(cors)
            .configure(routes::ingest::configure),
    )
    .await;

    let req = test::TestRequest::default()
        .method(actix_web::http::Method::OPTIONS)
        .uri(&format!("/api/{}/envelope/", project_id))
        .insert_header(("Origin", "https://example.com"))
        .insert_header(("Access-Control-Request-Method", "POST"))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    // Check CORS headers
    let headers = resp.headers();
    assert!(headers.contains_key("access-control-allow-origin"));
    assert!(headers.contains_key("access-control-allow-methods"));
}

#[actix_web::test]
async fn test_ingest_response_has_cors_headers() {
    let db = TestDb::new().await;
    let (project_id, sentry_key) = create_test_project(&db.pool, "CORS Response Project").await;
    let config = create_test_config();

    // CORS is handled by middleware, so we need to include it in the test
    let cors = actix_cors::Cors::default()
        .allow_any_origin()
        .allowed_methods(vec!["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
        .allowed_headers(vec![
            actix_web::http::header::AUTHORIZATION,
            actix_web::http::header::ACCEPT,
            actix_web::http::header::CONTENT_TYPE,
            actix_web::http::header::CONTENT_ENCODING,
            actix_web::http::header::HeaderName::from_static("x-sentry-auth"),
        ])
        .max_age(3600);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(cors)
            .configure(routes::ingest::configure),
    )
    .await;

    let event_id = Uuid::new_v4().to_string().replace("-", "");
    let event_json = json!({"event_id": event_id}).to_string();
    let envelope = create_envelope(&event_id, &event_json);

    let req = test::TestRequest::post()
        .uri(&format!("/api/{}/envelope/", project_id))
        .insert_header(("Origin", "https://example.com"))
        .insert_header((
            "X-Sentry-Auth",
            format!("Sentry sentry_key={}, sentry_version=7", sentry_key),
        ))
        .set_payload(envelope)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let headers = resp.headers();
    // CORS reflects the Origin header back
    assert_eq!(
        headers.get("access-control-allow-origin").unwrap(),
        "https://example.com"
    );
}

// =============================================================================
// Payload Size Tests
// =============================================================================

#[actix_web::test]
async fn test_ingest_large_payload_above_256kb_is_accepted() {
    let db = TestDb::new().await;
    let (project_id, sentry_key) = create_test_project(&db.pool, "Large Payload Project").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::ingest::configure),
    )
    .await;

    let event_id = Uuid::new_v4().to_string().replace("-", "");
    // Build an event whose JSON exceeds actix-web's default 256KB body limit.
    // Without an explicit PayloadConfig, the framework rejects this before the
    // handler runs, returning 413 instead of 200.
    let padding = "x".repeat(300_000);
    let event_json = json!({
        "event_id": event_id,
        "timestamp": 1704801600.0,
        "level": "error",
        "platform": "python",
        "exception": {
            "values": [{"type": "ValueError", "value": "large stack trace"}]
        },
        "_padding": padding
    })
    .to_string();

    assert!(
        event_json.len() > 256 * 1024,
        "test payload must exceed 256KB, got {} bytes",
        event_json.len()
    );

    let envelope = create_envelope(&event_id, &event_json);

    let req = test::TestRequest::post()
        .uri(&format!("/api/{}/envelope/", project_id))
        .insert_header((
            "X-Sentry-Auth",
            format!("Sentry sentry_key={}, sentry_version=7", sentry_key),
        ))
        .insert_header(("Content-Type", "application/x-sentry-envelope"))
        .set_payload(envelope)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(
        resp.status(),
        200,
        "payloads above 256KB must be accepted by the ingest endpoint"
    );
}

// =============================================================================
// Legacy Store Endpoint Tests
// =============================================================================

#[actix_web::test]
async fn test_store_endpoint_deprecated() {
    let db = TestDb::new().await;
    let (project_id, sentry_key) = create_test_project(&db.pool, "Store Project").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::ingest::configure),
    )
    .await;

    let req = test::TestRequest::post()
        .uri(&format!("/api/{}/store/", project_id))
        .insert_header((
            "X-Sentry-Auth",
            format!("Sentry sentry_key={}, sentry_version=7", sentry_key),
        ))
        .set_payload(b"{}".to_vec())
        .to_request();

    let resp = test::call_service(&app, req).await;
    // Should return 400 because store is deprecated
    assert_eq!(resp.status(), 400);
}

// =============================================================================
// Payload Size Tests (M-1)
// =============================================================================

#[actix_web::test]
async fn test_ingest_oversized_body_returns_413_json() {
    let db = TestDb::new().await;
    let (project_id, sentry_key) = create_test_project(&db.pool, "Payload Limit Project").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::ingest::configure),
    )
    .await;

    // 300KB plain body — exceeds actix-web default 256KB Bytes extractor limit
    let large_body = vec![b'x'; 300 * 1024];

    let req = test::TestRequest::post()
        .uri(&format!("/api/{}/envelope/", project_id))
        .insert_header((
            "X-Sentry-Auth",
            format!("Sentry sentry_key={}, sentry_version=7", sentry_key),
        ))
        .set_payload(large_body)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(
        resp.status(),
        413,
        "Oversized body must return 413, not {}",
        resp.status()
    );

    let body = test::read_body(resp).await;
    let body_str = std::str::from_utf8(&body).unwrap();
    let json: Value = serde_json::from_str(body_str)
        .expect(&format!("413 response must be JSON, got: {body_str}"));
    assert_eq!(
        json["error"]["type"], "PayloadTooLarge",
        "Error type must be PayloadTooLarge: {body_str}"
    );
}
