//! Integration tests for the Source Maps API
//!
//! Story: source-map-upload-frame-rewriting
//!
//! ## Coverage Map
//!
//! | Test group                        | Task    | AC          |
//! |-----------------------------------|---------|-------------|
//! | org_probe_*                       | T6      | AC1 prereq  |
//! | chunk_capability_*                | T6      | AC1 prereq  |
//! | chunk_upload_*                    | T6      | AC1, AC3    |
//! | assemble_*                        | T6, T7  | AC1, AC3, AC6, AC7 |
//! | list_source_maps_*                | T6      | AC1         |
//! | digest_rewrite_*                  | T8      | AC2         |
//! | cross_project_*                   | T5, T8  | AC5         |
//! | worker_recovery_*                 | T7      | AC7         |

use crate::common::TestDb;
use actix_web::{test, web, App};
use rustrak::config::{Config, DatabaseConfig, RateLimitConfig};
use rustrak::models::{CreateAuthToken, CreateProject};
use rustrak::routes;
use rustrak::services::{
    AuthTokenService, DbSourceMapProvider, LocalSourceMapStore, ProjectService, SourceMapProvider,
    SourceMapStore,
};
use serde_json::Value;
use sha1::{Digest as _, Sha1};
use std::sync::Arc;
use std::time::Duration;

// =============================================================================
// Test helpers
// =============================================================================

fn create_test_config() -> Config {
    Config {
        host: "127.0.0.1".to_string(),
        port: 0,
        database: DatabaseConfig {
            url: "sqlite::memory:".to_string(),
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
        ingest_dir: None,
        public_url: None,
        sourcemap_storage_path: "/tmp/test_sourcemaps".to_string(),
        max_chunk_size_bytes: 10 * 1024 * 1024,
    }
}

async fn create_test_token(pool: &rustrak::db::DbPool) -> String {
    AuthTokenService::create(
        pool,
        CreateAuthToken {
            description: Some("Test token".to_string()),
        },
    )
    .await
    .expect("Failed to create test token")
    .token
}

/// Build the sourcemap app data components from a pool + config.
/// Returns `(Arc<dyn SourceMapProvider>, web::Data<Config>)` so tests can
/// call `test::init_service(App::new().app_data(...)...)` inline.
fn sourcemap_app_data(
    pool: &rustrak::db::DbPool,
    config: &Config,
) -> (Arc<dyn SourceMapProvider>, web::Data<Config>) {
    let store: Arc<dyn SourceMapStore> =
        Arc::new(LocalSourceMapStore::new(&config.sourcemap_storage_path));
    let provider: Arc<dyn SourceMapProvider> =
        Arc::new(DbSourceMapProvider::new(pool.clone(), store));
    (provider, web::Data::new(config.clone()))
}

fn sha1_hex(data: &[u8]) -> String {
    let mut h = Sha1::new();
    h.update(data);
    hex::encode(h.finalize())
}

fn build_multipart(boundary: &str, parts: &[(&str, &[u8])]) -> Vec<u8> {
    let mut body = Vec::new();
    for (name, data) in parts {
        body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
        body.extend_from_slice(
            format!(
                "Content-Disposition: form-data; name=\"{}\"; filename=\"{}\"\r\n",
                name, name
            )
            .as_bytes(),
        );
        body.extend_from_slice(b"Content-Type: application/octet-stream\r\n\r\n");
        body.extend_from_slice(data);
        body.extend_from_slice(b"\r\n");
    }
    body.extend_from_slice(format!("--{}--\r\n", boundary).as_bytes());
    body
}

// =============================================================================
// Group 1: Org probe — no DB, no auth needed
// =============================================================================

#[actix_web::test]
async fn test_org_probe_any_slug_returns_200() {
    let db = TestDb::new().await;
    let config = create_test_config();
    let (provider, config_data) = sourcemap_app_data(&db.pool, &config);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(config_data)
            .app_data(web::Data::new(Arc::clone(&provider)))
            .configure(routes::sourcemaps::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri("/api/0/organizations/any-random-slug/")
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["slug"], "any-random-slug");

    let features = body["features"]
        .as_array()
        .expect("features must be an array");
    assert!(
        features.iter().any(|f| f == "artifact-bundles"),
        "features must include artifact-bundles"
    );
    assert!(
        features.iter().any(|f| f == "artifact-bundles-v2"),
        "features must include artifact-bundles-v2"
    );
}

#[actix_web::test]
async fn test_org_probe_different_slugs_all_return_200() {
    let db = TestDb::new().await;
    let config = create_test_config();

    for slug in &["my-org", "123", "a-b-c-d", "UPPERCASE"] {
        let (provider, config_data) = sourcemap_app_data(&db.pool, &config);

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(db.pool.clone()))
                .app_data(config_data)
                .app_data(web::Data::new(Arc::clone(&provider)))
                .configure(routes::sourcemaps::configure),
        )
        .await;

        let req = test::TestRequest::get()
            .uri(&format!("/api/0/organizations/{}/", slug))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(
            resp.status(),
            200,
            "org probe for slug '{}' must return 200",
            slug
        );

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(
            body["slug"], *slug,
            "response slug must echo back the request slug"
        );
    }
}

// =============================================================================
// Group 2: Chunk upload capability — needs BearerAuth
// =============================================================================

#[actix_web::test]
async fn test_chunk_capability_includes_artifact_bundles_v2() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let config = create_test_config();
    let (provider, config_data) = sourcemap_app_data(&db.pool, &config);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(config_data)
            .app_data(web::Data::new(Arc::clone(&provider)))
            .configure(routes::sourcemaps::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri("/api/0/organizations/my-org/chunk-upload/")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;

    let accept = body["accept"].as_array().expect("accept must be an array");
    assert!(
        accept.iter().any(|a| a == "artifact_bundles"),
        "accept must include artifact_bundles"
    );
    assert!(
        accept.iter().any(|a| a == "artifact_bundles_v2"),
        "accept must include artifact_bundles_v2"
    );

    assert_eq!(body["hashAlgorithm"], "sha1");

    let chunk_size = body["chunkSize"]
        .as_u64()
        .expect("chunkSize must be a number");
    assert!(chunk_size > 0, "chunkSize must be positive");

    let chunks_per_req = body["chunksPerRequest"]
        .as_u64()
        .expect("chunksPerRequest must be a number");
    assert!(chunks_per_req > 0, "chunksPerRequest must be positive");
}

// =============================================================================
// Group 3: Chunk upload — needs BearerAuth + multipart
// =============================================================================

#[actix_web::test]
async fn test_chunk_upload_stores_chunks_in_db() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let config = create_test_config();
    let (provider, config_data) = sourcemap_app_data(&db.pool, &config);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(config_data)
            .app_data(web::Data::new(Arc::clone(&provider)))
            .configure(routes::sourcemaps::configure),
    )
    .await;

    let chunk1 = b"hello world chunk data";
    let chunk2 = b"another chunk of data";
    let sha1_1 = sha1_hex(chunk1);
    let sha1_2 = sha1_hex(chunk2);

    let boundary = "testboundary1234";
    let body = build_multipart(
        boundary,
        &[("file", chunk1.as_ref()), ("file", chunk2.as_ref())],
    );

    let req = test::TestRequest::post()
        .uri("/api/0/organizations/my-org/chunk-upload/")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header((
            "Content-Type",
            format!("multipart/form-data; boundary={}", boundary),
        ))
        .set_payload(body)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // Verify via get_missing_chunks: both checksums are present, nothing missing
    let missing = rustrak::services::sourcemap::get_missing_chunks(
        &db.pool,
        &[sha1_1.clone(), sha1_2.clone()],
    )
    .await
    .expect("get_missing_chunks must succeed");
    assert!(
        missing.is_empty(),
        "after upload, no chunks should be missing; got: {:?}",
        missing
    );
}

#[actix_web::test]
async fn test_chunk_upload_chunk_too_large_returns_400() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    // Config with max_chunk_size_bytes = 100 bytes
    let mut config = create_test_config();
    config.max_chunk_size_bytes = 100;
    let (provider, config_data) = sourcemap_app_data(&db.pool, &config);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(config_data)
            .app_data(web::Data::new(Arc::clone(&provider)))
            .configure(routes::sourcemaps::configure),
    )
    .await;

    // Build a chunk that exceeds 100 bytes
    let oversized: Vec<u8> = vec![0xAA; 200];
    let boundary = "smalllimitboundary";
    let body = build_multipart(boundary, &[("file", &oversized)]);

    let req = test::TestRequest::post()
        .uri("/api/0/organizations/my-org/chunk-upload/")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header((
            "Content-Type",
            format!("multipart/form-data; boundary={}", boundary),
        ))
        .set_payload(body)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400, "oversized chunk must return 400");
}

#[actix_web::test]
async fn test_chunk_upload_no_file_parts_returns_400() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let config = create_test_config();
    let (provider, config_data) = sourcemap_app_data(&db.pool, &config);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(config_data)
            .app_data(web::Data::new(Arc::clone(&provider)))
            .configure(routes::sourcemaps::configure),
    )
    .await;

    // Build multipart with a field named "other" (not "file")
    let boundary = "noboundary9876";
    let body = build_multipart(boundary, &[("other", b"some data".as_ref())]);

    let req = test::TestRequest::post()
        .uri("/api/0/organizations/my-org/chunk-upload/")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header((
            "Content-Type",
            format!("multipart/form-data; boundary={}", boundary),
        ))
        .set_payload(body)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(
        resp.status(),
        400,
        "multipart with no 'file' parts must return 400"
    );
}

#[actix_web::test]
async fn test_chunk_upload_dedup_same_sha1() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let config = create_test_config();
    let sha1_val = sha1_hex(b"deduplicated chunk data");
    let boundary = "dedup1234";

    // Upload the same chunk twice
    for _ in 0..2 {
        let (provider, config_data) = sourcemap_app_data(&db.pool, &config);
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(db.pool.clone()))
                .app_data(config_data)
                .app_data(web::Data::new(Arc::clone(&provider)))
                .configure(routes::sourcemaps::configure),
        )
        .await;

        let body = build_multipart(boundary, &[("file", b"deduplicated chunk data".as_ref())]);
        let req = test::TestRequest::post()
            .uri("/api/0/organizations/my-org/chunk-upload/")
            .insert_header(("Authorization", format!("Bearer {}", token)))
            .insert_header((
                "Content-Type",
                format!("multipart/form-data; boundary={}", boundary),
            ))
            .set_payload(body)
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200, "both uploads must return 200");
    }

    // Verify exactly one row exists in DB for this SHA1
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM chunk WHERE checksum = ?")
        .bind(&sha1_val)
        .fetch_one(&db.pool)
        .await
        .expect("count query must succeed");
    assert_eq!(
        count, 1,
        "dedup: only 1 row should exist for duplicate upload"
    );
}

// =============================================================================
// Group 4: Assemble — needs BearerAuth + JSON + project in DB
// =============================================================================

#[actix_web::test]
async fn test_assemble_before_upload_returns_not_found_with_missing_chunks() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;

    // Create a project
    let project = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "my-proj-assemble-missing".to_string(),
            slug: Some("my-proj-assemble-missing".to_string()),
        },
    )
    .await
    .expect("project creation must succeed");

    let config = create_test_config();
    let (provider, config_data) = sourcemap_app_data(&db.pool, &config);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(config_data)
            .app_data(web::Data::new(Arc::clone(&provider)))
            .configure(routes::sourcemaps::configure),
    )
    .await;

    let sha1_a = "aabbccddaabbccddaabbccddaabbccddaabbccdd";
    let sha1_b = "bbccddeebbccddeebbccddeebbccddeebbccddee";

    let req = test::TestRequest::post()
        .uri("/api/0/organizations/my-org/artifactbundle/assemble/")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(serde_json::json!({
            "checksum": "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
            "chunks": [sha1_a, sha1_b],
            "projects": [project.slug]
        }))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 202, "missing chunks must return 202");

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["state"], "not_found");

    let missing = body["missingChunks"]
        .as_array()
        .expect("missingChunks must be an array");
    assert_eq!(missing.len(), 2, "both chunks should be missing");
    assert!(missing.iter().any(|c| c == sha1_a));
    assert!(missing.iter().any(|c| c == sha1_b));
}

#[actix_web::test]
async fn test_assemble_after_upload_enqueues_job_returns_created() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;

    let project = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "assemble-after-upload".to_string(),
            slug: Some("assemble-after-upload".to_string()),
        },
    )
    .await
    .expect("project creation must succeed");

    let config = create_test_config();

    // Store two chunks directly in the DB
    let chunk1: &[u8] = b"chunk one data here";
    let chunk2: &[u8] = b"chunk two data here";
    rustrak::services::sourcemap::store_chunks(
        &db.pool,
        vec![
            (sha1_hex(chunk1), chunk1.to_vec()),
            (sha1_hex(chunk2), chunk2.to_vec()),
        ],
        config.max_chunk_size_bytes,
    )
    .await
    .expect("store_chunks must succeed");

    // Compute the bundle checksum: SHA1 of chunk1 ++ chunk2
    let mut joined = chunk1.to_vec();
    joined.extend_from_slice(chunk2);
    let bundle_checksum = sha1_hex(&joined);

    let (provider, config_data) = sourcemap_app_data(&db.pool, &config);
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(config_data)
            .app_data(web::Data::new(Arc::clone(&provider)))
            .configure(routes::sourcemaps::configure),
    )
    .await;

    let req = test::TestRequest::post()
        .uri("/api/0/organizations/my-org/artifactbundle/assemble/")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(serde_json::json!({
            "checksum": bundle_checksum,
            "chunks": [sha1_hex(chunk1), sha1_hex(chunk2)],
            "projects": [project.slug]
        }))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["state"], "created");

    let missing = body["missingChunks"]
        .as_array()
        .expect("missingChunks must be array");
    assert!(
        missing.is_empty(),
        "no chunks should be missing after upload"
    );
}

#[actix_web::test]
async fn test_assemble_idempotent_same_bundle_twice() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;

    let project = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "assemble-idempotent".to_string(),
            slug: Some("assemble-idempotent".to_string()),
        },
    )
    .await
    .expect("project creation must succeed");

    let config = create_test_config();

    // Pre-store chunks
    let chunk1: &[u8] = b"idempotent chunk data one";
    let chunk2: &[u8] = b"idempotent chunk data two";
    rustrak::services::sourcemap::store_chunks(
        &db.pool,
        vec![
            (sha1_hex(chunk1), chunk1.to_vec()),
            (sha1_hex(chunk2), chunk2.to_vec()),
        ],
        config.max_chunk_size_bytes,
    )
    .await
    .expect("store_chunks must succeed");

    let mut joined = chunk1.to_vec();
    joined.extend_from_slice(chunk2);
    let bundle_checksum = sha1_hex(&joined);

    // Insert an assembly_jobs row with state='ok' directly
    sqlx::query(
        "INSERT INTO assembly_jobs(bundle_checksum, project_id, chunks, state, detail) \
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&bundle_checksum)
    .bind(project.id)
    .bind("[]")
    .bind("ok")
    .bind(Option::<String>::None)
    .execute(&db.pool)
    .await
    .expect("direct insert of assembly_jobs must succeed");

    let (provider, config_data) = sourcemap_app_data(&db.pool, &config);
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(config_data)
            .app_data(web::Data::new(Arc::clone(&provider)))
            .configure(routes::sourcemaps::configure),
    )
    .await;

    // POST assemble — should return the existing 'ok' job
    let req = test::TestRequest::post()
        .uri("/api/0/organizations/my-org/artifactbundle/assemble/")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(serde_json::json!({
            "checksum": bundle_checksum,
            "chunks": [sha1_hex(chunk1), sha1_hex(chunk2)],
            "projects": [project.slug]
        }))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["state"], "ok");

    // Verify exactly one assembly_jobs row
    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM assembly_jobs WHERE bundle_checksum = ?")
            .bind(&bundle_checksum)
            .fetch_one(&db.pool)
            .await
            .expect("count query must succeed");
    assert_eq!(count, 1, "idempotent: only 1 assembly_jobs row expected");
}

#[actix_web::test]
async fn test_assemble_unknown_project_slug_returns_404() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let config = create_test_config();
    let (provider, config_data) = sourcemap_app_data(&db.pool, &config);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(config_data)
            .app_data(web::Data::new(Arc::clone(&provider)))
            .configure(routes::sourcemaps::configure),
    )
    .await;

    let req = test::TestRequest::post()
        .uri("/api/0/organizations/my-org/artifactbundle/assemble/")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(serde_json::json!({
            "checksum": "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
            "chunks": [],
            "projects": ["nonexistent-project-xyz"]
        }))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404, "unknown project slug must return 404");
}

#[actix_web::test]
async fn test_assemble_empty_projects_array_returns_400() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let config = create_test_config();
    let (provider, config_data) = sourcemap_app_data(&db.pool, &config);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(config_data)
            .app_data(web::Data::new(Arc::clone(&provider)))
            .configure(routes::sourcemaps::configure),
    )
    .await;

    let req = test::TestRequest::post()
        .uri("/api/0/organizations/my-org/artifactbundle/assemble/")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(serde_json::json!({
            "checksum": "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
            "chunks": [],
            "projects": []
        }))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400, "empty projects array must return 400");
}

#[actix_web::test]
#[ignore = "requires assembly worker to process ZIP and set error state"]
async fn test_assemble_zip_path_traversal_sets_error_state() {
    // This test requires the background assembly worker to process the job.
    // When a ZIP containing a path traversal entry (e.g. "../../../etc/passwd") is
    // submitted, the worker must set assembly_jobs.state = 'error'.
    //
    // Setup: insert an assembly_jobs row pointing to a ZIP with path traversal entries,
    // start the AssemblyWorker, wait for job processing, then assert:
    //   let job: AssemblyJob = sqlx::query_as("SELECT * FROM assembly_jobs WHERE ...").fetch_one(&pool).await.unwrap();
    //   assert_eq!(job.state, "error");
    //   assert!(job.detail.unwrap().contains("path traversal"));
    todo!("enable once assembly worker is running in test context")
}

#[actix_web::test]
#[ignore = "requires assembly worker to process ZIP and set error state"]
async fn test_assemble_zip_symlink_sets_error_state() {
    // This test requires the background assembly worker.
    // When a ZIP containing a symlink entry (CVE-2025-29787) is submitted,
    // the worker must skip it and not create any symlink on disk.
    //
    // Setup: build a ZIP with a symlink entry, store its chunks, submit to assemble,
    // start AssemblyWorker, wait for processing, then assert:
    //   assert!(job.state == "ok" || job.state == "error"); // no symlink created on disk
    todo!("enable once assembly worker is running in test context")
}

#[actix_web::test]
async fn test_assemble_checksum_mismatch_returns_400() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;

    let project = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "assemble-checksum-mismatch".to_string(),
            slug: Some("assemble-checksum-mismatch".to_string()),
        },
    )
    .await
    .expect("project creation must succeed");

    let config = create_test_config();

    // Store two chunks
    let chunk1: &[u8] = b"mismatch chunk alpha";
    let chunk2: &[u8] = b"mismatch chunk beta";
    rustrak::services::sourcemap::store_chunks(
        &db.pool,
        vec![
            (sha1_hex(chunk1), chunk1.to_vec()),
            (sha1_hex(chunk2), chunk2.to_vec()),
        ],
        config.max_chunk_size_bytes,
    )
    .await
    .expect("store_chunks must succeed");

    let (provider, config_data) = sourcemap_app_data(&db.pool, &config);
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(config_data)
            .app_data(web::Data::new(Arc::clone(&provider)))
            .configure(routes::sourcemaps::configure),
    )
    .await;

    // Provide a deliberately wrong bundle checksum
    let wrong_checksum = "0000000000000000000000000000000000000000";

    let req = test::TestRequest::post()
        .uri("/api/0/organizations/my-org/artifactbundle/assemble/")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(serde_json::json!({
            "checksum": wrong_checksum,
            "chunks": [sha1_hex(chunk1), sha1_hex(chunk2)],
            "projects": [project.slug]
        }))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400, "checksum mismatch must return 400");

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["state"], "error");
    assert!(
        body["detail"]
            .as_str()
            .unwrap_or("")
            .contains("checksum mismatch"),
        "detail must mention checksum mismatch; got: {}",
        body["detail"]
    );
}

#[actix_web::test]
async fn test_assemble_failed_job_returns_400_on_retry() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;

    let project = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "assemble-failed-retry".to_string(),
            slug: Some("assemble-failed-retry".to_string()),
        },
    )
    .await
    .expect("project creation must succeed");

    // Use a fake checksum for a pre-existing 'error' job
    let fake_checksum = "cafebabecafebabecafebabecafebabecafebabe";

    // Insert an assembly_jobs row with state='error' directly
    sqlx::query(
        "INSERT INTO assembly_jobs(bundle_checksum, project_id, chunks, state, detail) \
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(fake_checksum)
    .bind(project.id)
    .bind("[]")
    .bind("error")
    .bind("assembly failed: some test error")
    .execute(&db.pool)
    .await
    .expect("direct insert of failed assembly_jobs must succeed");

    let config = create_test_config();
    let (provider, config_data) = sourcemap_app_data(&db.pool, &config);
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(config_data)
            .app_data(web::Data::new(Arc::clone(&provider)))
            .configure(routes::sourcemaps::configure),
    )
    .await;

    // POST assemble — must return the existing 'error' job → 400
    let req = test::TestRequest::post()
        .uri("/api/0/organizations/my-org/artifactbundle/assemble/")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(serde_json::json!({
            "checksum": fake_checksum,
            "chunks": [],
            "projects": [project.slug]
        }))
        .to_request();

    let resp = test::call_service(&app, req).await;
    // Handler maps state="error" → HttpResponse::BadRequest (400)
    assert_eq!(resp.status(), 400, "errored job must return 400 on retry");

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["state"], "error");
    assert!(
        body["detail"]
            .as_str()
            .unwrap_or("")
            .contains("assembly failed"),
        "detail must contain the stored error message; got: {}",
        body["detail"]
    );
}

// =============================================================================
// Group 5: List source maps
// =============================================================================

#[actix_web::test]
async fn test_list_source_maps_returns_paginated_list() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;

    let project = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "list-sourcemaps-proj".to_string(),
            slug: Some("list-sourcemaps-proj".to_string()),
        },
    )
    .await
    .expect("project creation must succeed");

    // Insert two source_file + source_file_metadata rows directly
    let file_id_a = uuid::Uuid::new_v4().to_string();
    let debug_id_a = uuid::Uuid::new_v4().to_string();
    let file_id_b = uuid::Uuid::new_v4().to_string();
    let debug_id_b = uuid::Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO source_file(id, checksum, size, storage_path) VALUES (?, ?, ?, ?)")
        .bind(&file_id_a)
        .bind("checksum_a_001")
        .bind(1234i32)
        .bind("/tmp/test_a.map")
        .execute(&db.pool)
        .await
        .expect("insert source_file A");

    sqlx::query(
        "INSERT INTO source_file_metadata(id, project_id, debug_id, file_type, file_id) \
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(project.id)
    .bind(&debug_id_a)
    .bind("source_map")
    .bind(&file_id_a)
    .execute(&db.pool)
    .await
    .expect("insert source_file_metadata A");

    sqlx::query("INSERT INTO source_file(id, checksum, size, storage_path) VALUES (?, ?, ?, ?)")
        .bind(&file_id_b)
        .bind("checksum_b_002")
        .bind(5678i32)
        .bind("/tmp/test_b.map")
        .execute(&db.pool)
        .await
        .expect("insert source_file B");

    sqlx::query(
        "INSERT INTO source_file_metadata(id, project_id, debug_id, file_type, file_id) \
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(project.id)
    .bind(&debug_id_b)
    .bind("source_map")
    .bind(&file_id_b)
    .execute(&db.pool)
    .await
    .expect("insert source_file_metadata B");

    let config = create_test_config();
    let (provider, config_data) = sourcemap_app_data(&db.pool, &config);
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(config_data)
            .app_data(web::Data::new(Arc::clone(&provider)))
            .configure(routes::sourcemaps::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/0/projects/my-org/{}/files/source-maps/",
            project.slug
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    let entries = body["data"].as_array().expect("data must be an array");
    assert_eq!(entries.len(), 2, "must return exactly 2 source map entries");

    for entry in entries {
        assert!(entry.get("debugId").is_some(), "entry must have debugId");
        assert!(entry.get("fileType").is_some(), "entry must have fileType");
        assert!(entry.get("size").is_some(), "entry must have size");
        assert!(
            entry.get("timesUsed").is_some(),
            "entry must have timesUsed"
        );
        assert!(
            entry.get("dateUploaded").is_some(),
            "entry must have dateUploaded"
        );
    }
}

#[actix_web::test]
async fn test_list_source_maps_unknown_project_returns_404() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let config = create_test_config();
    let (provider, config_data) = sourcemap_app_data(&db.pool, &config);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(config_data)
            .app_data(web::Data::new(Arc::clone(&provider)))
            .configure(routes::sourcemaps::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri("/api/0/projects/my-org/ghost-project/files/source-maps/")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404, "unknown project must return 404");
}

#[actix_web::test]
async fn test_list_source_maps_scoped_to_project() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;

    let proj_a = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "sourcemaps-scope-a".to_string(),
            slug: Some("sourcemaps-scope-a".to_string()),
        },
    )
    .await
    .expect("project A creation");

    let proj_b = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "sourcemaps-scope-b".to_string(),
            slug: Some("sourcemaps-scope-b".to_string()),
        },
    )
    .await
    .expect("project B creation");

    let debug_id_a = uuid::Uuid::new_v4().to_string();
    let debug_id_b = uuid::Uuid::new_v4().to_string();

    // Insert source map for project A
    let file_id_a = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO source_file(id, checksum, size, storage_path) VALUES (?, ?, ?, ?)")
        .bind(&file_id_a)
        .bind("scope_checksum_a")
        .bind(100i32)
        .bind("/tmp/scope_a.map")
        .execute(&db.pool)
        .await
        .unwrap();

    sqlx::query(
        "INSERT INTO source_file_metadata(id, project_id, debug_id, file_type, file_id) \
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(proj_a.id)
    .bind(&debug_id_a)
    .bind("source_map")
    .bind(&file_id_a)
    .execute(&db.pool)
    .await
    .unwrap();

    // Insert source map for project B
    let file_id_b = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO source_file(id, checksum, size, storage_path) VALUES (?, ?, ?, ?)")
        .bind(&file_id_b)
        .bind("scope_checksum_b")
        .bind(200i32)
        .bind("/tmp/scope_b.map")
        .execute(&db.pool)
        .await
        .unwrap();

    sqlx::query(
        "INSERT INTO source_file_metadata(id, project_id, debug_id, file_type, file_id) \
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(proj_b.id)
    .bind(&debug_id_b)
    .bind("source_map")
    .bind(&file_id_b)
    .execute(&db.pool)
    .await
    .unwrap();

    let config = create_test_config();
    let (provider, config_data) = sourcemap_app_data(&db.pool, &config);
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(config_data)
            .app_data(web::Data::new(Arc::clone(&provider)))
            .configure(routes::sourcemaps::configure),
    )
    .await;

    // GET source maps for project A only
    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/0/projects/my-org/{}/files/source-maps/",
            proj_a.slug
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    let entries = body["data"].as_array().expect("data must be array");

    assert_eq!(entries.len(), 1, "only 1 entry for project A");

    // The debug_id must be A's, not B's
    let returned_debug_id = entries[0]["debugId"].as_str().unwrap_or("");
    assert_eq!(
        returned_debug_id, debug_id_a,
        "project A's source map must have debug_id_a; got {}",
        returned_debug_id
    );
    assert_ne!(
        returned_debug_id, debug_id_b,
        "project B's debug_id must not appear in project A's results"
    );
}

// =============================================================================
// Group 5b: assemble_bundle regression — manifest.json extraction
// =============================================================================

/// Build a minimal but valid artifact bundle ZIP in memory.
///
/// The ZIP contains:
///   - `~/app.min.js.map`  — a trivial source map JSON
///   - `manifest.json`     — Sentry manifest with `files` + empty `debugIdMap`
///
/// The `manifest.json` has no `debug-id` headers, so the server's file-processing
/// loop will skip all entries and return Ok(()) without storing anything — but it
/// MUST be able to FIND and PARSE the manifest.  If the extraction puts files in
/// the wrong directory the server returns `manifest.json not found`.
fn build_test_artifact_bundle() -> Vec<u8> {
    use std::io::Write as _;
    use zip::write::SimpleFileOptions;

    let source_map = br#"{"version":3,"sources":["src/app.ts"],"sourcesContent":[""],"mappings":"AAAA","names":[]}"#;
    let manifest = br#"{"files":{"~/app.min.js.map":{"url":"~/app.min.js.map","type":"source_map","headers":{}}},"debugIdMap":{}}"#;

    let mut buf = std::io::Cursor::new(Vec::new());
    {
        let mut zip = zip::ZipWriter::new(&mut buf);
        let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
        zip.start_file("~/app.min.js.map", opts).unwrap();
        zip.write_all(source_map).unwrap();
        zip.start_file("manifest.json", opts).unwrap();
        zip.write_all(manifest).unwrap();
        zip.finish().unwrap();
    }
    buf.into_inner()
}

#[actix_web::test]
async fn test_assemble_bundle_finds_manifest_json() {
    // Regression: the path traversal guard in assemble_bundle iterated
    // raw_dest.components() instead of Path::new(&name).components().
    // This doubled the extract_dir prefix so manifest.json was written to
    // {extract_dir}/{extract_dir}/manifest.json, and the subsequent
    // std::fs::read({extract_dir}/manifest.json) always failed.
    let db = TestDb::new().await;

    let project = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "manifest-extraction".to_string(),
            slug: Some("manifest-extraction".to_string()),
        },
    )
    .await
    .expect("project creation must succeed");

    let bundle = build_test_artifact_bundle();
    let bundle_checksum = sha1_hex(&bundle);

    rustrak::services::sourcemap::store_chunks(
        &db.pool,
        vec![(bundle_checksum.clone(), bundle)],
        20 * 1024 * 1024,
    )
    .await
    .expect("store_chunks must succeed");

    let config = create_test_config();
    let store: std::sync::Arc<dyn rustrak::services::SourceMapStore> = std::sync::Arc::new(
        rustrak::services::LocalSourceMapStore::new(&config.sourcemap_storage_path),
    );

    // Before fix: returns Err(Validation("manifest.json not found in artifact bundle"))
    // After fix:  returns Ok(())
    let result = rustrak::services::sourcemap::assemble_bundle(
        &db.pool,
        store.as_ref(),
        project.id,
        &bundle_checksum,
        &[bundle_checksum.clone()],
    )
    .await;

    assert!(
        result.is_ok(),
        "assemble_bundle must succeed; got: {:?}",
        result.err()
    );
}

// =============================================================================
// Group 5d: Postgres enum regression — only meaningful with --features postgres
// =============================================================================

// Guard: assembly_state ENUM in Postgres must be decodable as String.
//
// Regression: the first implementation of artifact_bundle_assemble used
// `RETURNING *` / `SELECT *` on assembly_jobs. In Postgres, the `state`
// column is typed as `assembly_state` (a custom ENUM), which SQLx cannot
// decode into a Rust `String` — it returns a DatabaseError at runtime and
// the endpoint returns HTTP 500.
//
// This test pins that behaviour: once the state column is TEXT the test
// passes; if someone re-introduces an ENUM it will fail immediately.
#[cfg(feature = "postgres")]
#[actix_web::test]
async fn test_assemble_state_column_decodable_in_postgres() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;

    let project = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "pg-state-decode".to_string(),
            slug: Some("pg-state-decode".to_string()),
        },
    )
    .await
    .expect("project creation must succeed");

    // One chunk — size of the bundle equals size of this single chunk
    let chunk: &[u8] = b"postgres assembly_state enum regression test data";
    let chunk_hash = sha1_hex(chunk);
    let bundle_checksum = chunk_hash.clone();

    rustrak::services::sourcemap::store_chunks(
        &db.pool,
        vec![(chunk_hash.clone(), chunk.to_vec())],
        10 * 1024 * 1024,
    )
    .await
    .expect("store_chunks must succeed");

    let config = create_test_config();
    let (provider, config_data) = sourcemap_app_data(&db.pool, &config);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(config_data)
            .app_data(web::Data::new(Arc::clone(&provider)))
            .configure(routes::sourcemaps::configure),
    )
    .await;

    let req = test::TestRequest::post()
        .uri("/api/0/organizations/my-org/artifactbundle/assemble/")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(serde_json::json!({
            "checksum": bundle_checksum,
            "chunks": [chunk_hash],
            "projects": [project.slug]
        }))
        .to_request();

    let resp = test::call_service(&app, req).await;
    // Before fix: HTTP 500 — "mismatched types … assembly_state"
    // After fix:  HTTP 200 with state in {"created","assembling","ok"}
    assert_eq!(
        resp.status(),
        200,
        "assemble must not 500 on Postgres — state column decode regression"
    );

    let body: Value = test::read_body_json(resp).await;
    let state = body["state"].as_str().unwrap_or("");
    assert!(
        ["created", "assembling", "ok"].contains(&state),
        "state must be a valid assembly state string; got: '{}'",
        state
    );
}

// =============================================================================
// Group 6: Worker recovery — keep #[ignore = "requires worker"]
// =============================================================================

#[actix_web::test]
#[ignore = "requires AssemblyWorker running in test context to reset stuck jobs"]
async fn test_worker_restart_recovery_resets_stuck_assembling_jobs() {
    // GIVEN: an assembly_jobs row with state='assembling', locked_until < NOW() (expired lock),
    //        retry_count=0
    // WHEN:  AssemblyWorker::run() starts (simulating server restart)
    // THEN:  the startup recovery query resets the row to state='created', locked_until=NULL
    //        AND the job is picked up in the next poll cycle
    //
    // Setup:
    //   sqlx::query("INSERT INTO assembly_jobs(bundle_checksum, project_id, chunks, state, locked_until) ...")
    //     .bind(checksum).bind(project_id).bind("[]").bind("assembling")
    //     .bind(some_past_datetime)
    //     .execute(&db.pool).await.unwrap();
    //   // Start worker, wait one poll cycle
    //   let job: AssemblyJob = sqlx::query_as("SELECT * FROM assembly_jobs WHERE ...").fetch_one(&pool).await.unwrap();
    //   assert_eq!(job.state, "created");
    //   assert!(job.locked_until.is_none());
    todo!("enable once AssemblyWorker is injectable in tests")
}

#[actix_web::test]
#[ignore = "requires AssemblyWorker with retry logic to exhaust retries"]
async fn test_worker_exhausts_retries_sets_error_state() {
    // GIVEN: an assembly_jobs row with state='created', retry_count = max_retries - 1,
    //        AND a bundle that will always fail (e.g. invalid ZIP data)
    // WHEN:  the worker processes the job and it fails
    // THEN:  assembly_jobs.state = 'error'
    //        AND assembly_jobs.detail contains the last error message
    //        AND retry_count == max_retries
    todo!("enable once AssemblyWorker retry logic is injectable in tests")
}

// =============================================================================
// Group 7: Digest integration — keep #[ignore = "requires worker"]
// =============================================================================

#[actix_web::test]
#[ignore = "requires full digest pipeline with source map rewriting (T8)"]
async fn test_digest_rewrites_frames_when_sourcemap_present() {
    // GIVEN: source maps assembled and stored for project "test-proj"
    //        AND a Sentry event arrives with debug_meta.images pointing to a known debug_id
    //        AND the frame's (lineno, colno) maps to a known original position in the source map
    // WHEN:  the digest worker processes the event
    // THEN:  events.data has the frame rewritten:
    //          - filename changed to the original source file
    //          - lineno changed to the original 1-indexed line
    //          - context_line is a non-empty string
    todo!("enable after T8 digest integration is complete")
}

#[actix_web::test]
#[ignore = "requires full digest pipeline to verify graceful no-op (T8, AC4)"]
async fn test_digest_leaves_frame_unchanged_when_no_sourcemap() {
    // GIVEN: no source maps stored for the project
    //        AND a Sentry event with a frame that has debug_meta.images
    // WHEN:  the digest worker processes the event
    // THEN:  events.data has the frame with its original minified values
    //        AND the digest completes without error (non-fatal frame rewriting)
    todo!("enable after T8 digest integration is complete")
}

// =============================================================================
// Group 8: Cross-project isolation — keep #[ignore = "requires worker"]
// =============================================================================

#[actix_web::test]
#[ignore = "requires full digest pipeline with project-scoped source map isolation (T5 + T8, AC5)"]
async fn test_cross_project_source_maps_do_not_leak() {
    // GIVEN: source maps assembled for project A with debug_id X
    //        AND a Sentry event from project B with the same debug_id X in debug_meta.images
    // WHEN:  the digest worker processes project B's event
    // THEN:  project B's frames are NOT rewritten (source_file_metadata scoped by project_id)
    //        AND events.data for project B still has the original minified frame values
    todo!("enable after T5 project_id scoping + T8 are complete")
}
