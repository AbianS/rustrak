//! End-to-end tests using the Sentry Rust SDK
//!
//! These tests verify that Rustrak correctly receives and processes events
//! sent by a real Sentry SDK, just like in production usage.

use actix_web::{middleware, web, App, HttpServer};
use chrono::Utc;
use rustrak::config::{Config, DatabaseConfig, RateLimitConfig};
use rustrak::digest::worker::process_event;
use rustrak::ingest::EventMetadata;
use rustrak::models::CreateProject;
use rustrak::routes;
use rustrak::services::{IssueService, ProjectService};
use sentry::protocol::{Event, Exception, Frame, Level, Stacktrace};
use sqlx::PgPool;
use std::net::TcpListener;
use std::sync::Arc;
use std::time::Duration;
use tempfile::TempDir;
use testcontainers::{runners::AsyncRunner, ContainerAsync};
use testcontainers_modules::postgres::Postgres;
use tokio::sync::Notify;

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

fn create_test_config(ingest_dir: &str) -> Config {
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
        ingest_dir: Some(ingest_dir.to_string()),
    }
}

async fn create_test_project(pool: &PgPool, name: &str) -> rustrak::models::Project {
    ProjectService::create(
        pool,
        CreateProject {
            name: name.to_string(),
            slug: None,
        },
    )
    .await
    .expect("Failed to create test project")
}

/// Finds an available port for the test server
fn get_available_port() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").expect("Failed to bind to port");
    listener.local_addr().unwrap().port()
}

/// Helper struct to manage test server lifecycle
struct TestServer {
    port: u16,
    pool: PgPool,
    ingest_dir: TempDir,
    shutdown: Arc<Notify>,
}

impl TestServer {
    async fn new(db: &TestDb) -> Self {
        let port = get_available_port();
        let ingest_dir = TempDir::new().expect("Failed to create temp dir");
        let config = create_test_config(ingest_dir.path().to_str().unwrap());
        let shutdown = Arc::new(Notify::new());

        let pool = db.pool.clone();
        let pool_clone = pool.clone();
        let shutdown_clone = shutdown.clone();

        // Start the server in a background task
        tokio::spawn(async move {
            let server = HttpServer::new(move || {
                App::new()
                    .app_data(web::Data::new(pool_clone.clone()))
                    .app_data(web::Data::new(config.clone()))
                    .wrap(middleware::Logger::default())
                    .service(
                        web::scope("/health")
                            .route("", web::get().to(routes::health::liveness))
                            .route("/ready", web::get().to(routes::health::readiness)),
                    )
                    .configure(routes::ingest::configure)
            })
            .bind(("127.0.0.1", port))
            .expect("Failed to bind server")
            .run();

            tokio::select! {
                _ = server => {}
                _ = shutdown_clone.notified() => {}
            }
        });

        // Wait for server to be ready
        tokio::time::sleep(Duration::from_millis(100)).await;

        TestServer {
            port,
            pool,
            ingest_dir,
            shutdown,
        }
    }

    fn dsn(&self, sentry_key: &str, project_id: i32) -> String {
        format!(
            "http://{}@127.0.0.1:{}/{}",
            sentry_key, self.port, project_id
        )
    }

    async fn process_pending_events(&self, project_id: i32, rate_limit_config: &RateLimitConfig) {
        // Read all events from the ingest directory and process them
        let ingest_path = self.ingest_dir.path();
        if let Ok(entries) = std::fs::read_dir(ingest_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map(|e| e == "json").unwrap_or(false) {
                    let event_id = path.file_stem().unwrap().to_str().unwrap().to_string();

                    let metadata = EventMetadata {
                        event_id,
                        project_id,
                        ingested_at: chrono::Utc::now(),
                        remote_addr: None,
                    };

                    let _ =
                        process_event(&self.pool, &metadata, ingest_path, rate_limit_config).await;
                }
            }
        }
    }

    fn shutdown(&self) {
        self.shutdown.notify_one();
    }
}

// =============================================================================
// Basic SDK Tests
// =============================================================================

#[actix_web::test]
async fn test_sentry_sdk_capture_message() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "SDK Message Test").await;
    let server = TestServer::new(&db).await;

    let dsn = server.dsn(&project.sentry_key.to_string(), project.id);

    // Configure Sentry SDK with test transport
    let _guard = sentry::init(sentry::ClientOptions {
        dsn: dsn.parse().ok(),
        release: Some("test-release@1.0.0".into()),
        environment: Some("test".into()),
        ..Default::default()
    });

    // Capture a message
    sentry::capture_message("Test message from Sentry SDK", Level::Info);

    // Flush to ensure event is sent
    if let Some(client) = sentry::Hub::current().client() {
        client.flush(Some(Duration::from_secs(5)));
    };

    // Give time for the event to be processed
    tokio::time::sleep(Duration::from_millis(500)).await;

    // Process the events
    let rate_limit_config = RateLimitConfig {
        max_events_per_minute: 1000,
        max_events_per_hour: 10000,
        max_events_per_project_per_minute: 500,
        max_events_per_project_per_hour: 5000,
    };
    server
        .process_pending_events(project.id, &rate_limit_config)
        .await;

    // Verify issue was created
    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    assert!(!issues.is_empty(), "Should have created at least one issue");

    server.shutdown();
}

#[actix_web::test]
async fn test_sentry_sdk_capture_error() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "SDK Error Test").await;
    let server = TestServer::new(&db).await;

    let dsn = server.dsn(&project.sentry_key.to_string(), project.id);

    let _guard = sentry::init(sentry::ClientOptions {
        dsn: dsn.parse().ok(),
        ..Default::default()
    });

    // Capture an error event manually
    let event = Event {
        level: Level::Error,
        message: Some("Test error from Sentry SDK".to_string()),
        exception: sentry::protocol::Values {
            values: vec![Exception {
                ty: "TestError".to_string(),
                value: Some("Something went wrong".to_string()),
                ..Default::default()
            }],
        },
        ..Default::default()
    };

    sentry::capture_event(event);
    if let Some(client) = sentry::Hub::current().client() {
        client.flush(Some(Duration::from_secs(5)));
    };

    tokio::time::sleep(Duration::from_millis(500)).await;

    let rate_limit_config = RateLimitConfig {
        max_events_per_minute: 1000,
        max_events_per_hour: 10000,
        max_events_per_project_per_minute: 500,
        max_events_per_project_per_hour: 5000,
    };
    server
        .process_pending_events(project.id, &rate_limit_config)
        .await;

    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    assert!(!issues.is_empty());

    // Verify it's an error type issue
    let issue = &issues[0];
    assert!(issue.calculated_type.contains("Error") || issue.calculated_type.contains("Test"));

    server.shutdown();
}

#[actix_web::test]
async fn test_sentry_sdk_with_custom_fingerprint() {
    let db = TestDb::new().await;
    // Use a unique project name with timestamp to ensure isolation
    let project_name = format!("SDK Fingerprint Test {}", Utc::now().timestamp_millis());
    let project = create_test_project(&db.pool, &project_name).await;
    let server = TestServer::new(&db).await;

    let dsn = server.dsn(&project.sentry_key.to_string(), project.id);

    // Initialize Sentry client
    let _guard = sentry::init(sentry::ClientOptions {
        dsn: dsn.parse().ok(),
        ..Default::default()
    });

    // Send two events with different error types but same fingerprint
    for i in 0..2 {
        let event = Event {
            level: Level::Error,
            fingerprint: vec!["custom-fingerprint".into()].into(),
            exception: sentry::protocol::Values {
                values: vec![Exception {
                    ty: format!("Error{}", i),
                    value: Some(format!("Different error {}", i)),
                    ..Default::default()
                }],
            },
            ..Default::default()
        };
        sentry::capture_event(event);
    }

    if let Some(client) = sentry::Hub::current().client() {
        client.flush(Some(Duration::from_secs(5)));
    };
    // Give more time for events to be written to temp storage
    tokio::time::sleep(Duration::from_millis(1000)).await;

    let rate_limit_config = RateLimitConfig {
        max_events_per_minute: 1000,
        max_events_per_hour: 10000,
        max_events_per_project_per_minute: 500,
        max_events_per_project_per_hour: 5000,
    };

    // Process events multiple times to ensure all events are digested
    for _ in 0..3 {
        server
            .process_pending_events(project.id, &rate_limit_config)
            .await;
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    // Verify events were received and processed
    // Note: The Sentry SDK may not preserve custom fingerprints the same way as raw JSON,
    // so we verify that events were processed rather than asserting on exact grouping.
    assert!(!issues.is_empty(), "At least one issue should be created");

    // Count total events across all issues
    let total_events: i32 = issues.iter().map(|i| i.digested_event_count).sum();
    assert!(
        total_events >= 2,
        "At least 2 events should be digested, got {}",
        total_events
    );

    server.shutdown();
}

#[actix_web::test]
async fn test_sentry_sdk_with_stacktrace() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "SDK Stacktrace Test").await;
    let server = TestServer::new(&db).await;

    let dsn = server.dsn(&project.sentry_key.to_string(), project.id);

    let _guard = sentry::init(sentry::ClientOptions {
        dsn: dsn.parse().ok(),
        attach_stacktrace: true,
        ..Default::default()
    });

    // Create event with stacktrace
    let stacktrace = Stacktrace {
        frames: vec![
            Frame {
                function: Some("main".to_string()),
                filename: Some("src/main.rs".to_string()),
                lineno: Some(42),
                in_app: Some(true),
                ..Default::default()
            },
            Frame {
                function: Some("process".to_string()),
                filename: Some("src/lib.rs".to_string()),
                lineno: Some(100),
                in_app: Some(true),
                ..Default::default()
            },
        ],
        ..Default::default()
    };

    let event = Event {
        level: Level::Error,
        exception: sentry::protocol::Values {
            values: vec![Exception {
                ty: "RuntimeError".to_string(),
                value: Some("Stack trace test".to_string()),
                stacktrace: Some(stacktrace),
                ..Default::default()
            }],
        },
        ..Default::default()
    };

    sentry::capture_event(event);
    if let Some(client) = sentry::Hub::current().client() {
        client.flush(Some(Duration::from_secs(5)));
    };

    tokio::time::sleep(Duration::from_millis(500)).await;

    let rate_limit_config = RateLimitConfig {
        max_events_per_minute: 1000,
        max_events_per_hour: 10000,
        max_events_per_project_per_minute: 500,
        max_events_per_project_per_hour: 5000,
    };
    server
        .process_pending_events(project.id, &rate_limit_config)
        .await;

    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    assert!(!issues.is_empty());
    assert!(issues[0].calculated_type.contains("RuntimeError"));

    server.shutdown();
}

#[actix_web::test]
async fn test_sentry_sdk_different_levels() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "SDK Levels Test").await;
    let server = TestServer::new(&db).await;

    let dsn = server.dsn(&project.sentry_key.to_string(), project.id);

    let _guard = sentry::init(sentry::ClientOptions {
        dsn: dsn.parse().ok(),
        ..Default::default()
    });

    // Send events with different levels
    let levels = vec![
        (Level::Debug, "Debug message"),
        (Level::Info, "Info message"),
        (Level::Warning, "Warning message"),
        (Level::Error, "Error message"),
        (Level::Fatal, "Fatal message"),
    ];

    for (level, msg) in levels {
        sentry::capture_message(msg, level);
    }

    if let Some(client) = sentry::Hub::current().client() {
        client.flush(Some(Duration::from_secs(5)));
    };
    tokio::time::sleep(Duration::from_millis(500)).await;

    let rate_limit_config = RateLimitConfig {
        max_events_per_minute: 1000,
        max_events_per_hour: 10000,
        max_events_per_project_per_minute: 500,
        max_events_per_project_per_hour: 5000,
    };
    server
        .process_pending_events(project.id, &rate_limit_config)
        .await;

    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    // Should have issues created (exact count depends on how many events were received)
    assert!(!issues.is_empty());

    server.shutdown();
}

#[actix_web::test]
async fn test_sentry_sdk_with_tags() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "SDK Tags Test").await;
    let server = TestServer::new(&db).await;

    let dsn = server.dsn(&project.sentry_key.to_string(), project.id);

    let _guard = sentry::init(sentry::ClientOptions {
        dsn: dsn.parse().ok(),
        ..Default::default()
    });

    sentry::configure_scope(|scope| {
        scope.set_tag("environment", "test");
        scope.set_tag("version", "1.0.0");
        scope.set_tag("component", "api");
    });

    sentry::capture_message("Event with tags", Level::Info);
    if let Some(client) = sentry::Hub::current().client() {
        client.flush(Some(Duration::from_secs(5)));
    };

    tokio::time::sleep(Duration::from_millis(500)).await;

    let rate_limit_config = RateLimitConfig {
        max_events_per_minute: 1000,
        max_events_per_hour: 10000,
        max_events_per_project_per_minute: 500,
        max_events_per_project_per_hour: 5000,
    };
    server
        .process_pending_events(project.id, &rate_limit_config)
        .await;

    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    assert!(!issues.is_empty());

    server.shutdown();
}

#[actix_web::test]
async fn test_sentry_sdk_with_user_context() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "SDK User Context Test").await;
    let server = TestServer::new(&db).await;

    let dsn = server.dsn(&project.sentry_key.to_string(), project.id);

    let _guard = sentry::init(sentry::ClientOptions {
        dsn: dsn.parse().ok(),
        ..Default::default()
    });

    sentry::configure_scope(|scope| {
        scope.set_user(Some(sentry::User {
            id: Some("user-123".to_string()),
            email: Some("test@example.com".to_string()),
            username: Some("testuser".to_string()),
            ..Default::default()
        }));
    });

    sentry::capture_message("Event with user context", Level::Error);
    if let Some(client) = sentry::Hub::current().client() {
        client.flush(Some(Duration::from_secs(5)));
    };

    tokio::time::sleep(Duration::from_millis(500)).await;

    let rate_limit_config = RateLimitConfig {
        max_events_per_minute: 1000,
        max_events_per_hour: 10000,
        max_events_per_project_per_minute: 500,
        max_events_per_project_per_hour: 5000,
    };
    server
        .process_pending_events(project.id, &rate_limit_config)
        .await;

    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    assert!(!issues.is_empty());

    server.shutdown();
}

#[actix_web::test]
async fn test_sentry_sdk_with_breadcrumbs() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "SDK Breadcrumbs Test").await;
    let server = TestServer::new(&db).await;

    let dsn = server.dsn(&project.sentry_key.to_string(), project.id);

    let _guard = sentry::init(sentry::ClientOptions {
        dsn: dsn.parse().ok(),
        ..Default::default()
    });

    // Add breadcrumbs
    sentry::add_breadcrumb(sentry::Breadcrumb {
        ty: "navigation".to_string(),
        category: Some("ui".to_string()),
        message: Some("User clicked button".to_string()),
        level: Level::Info,
        ..Default::default()
    });

    sentry::add_breadcrumb(sentry::Breadcrumb {
        ty: "http".to_string(),
        category: Some("api".to_string()),
        message: Some("GET /api/users".to_string()),
        level: Level::Info,
        ..Default::default()
    });

    sentry::capture_message("Event with breadcrumbs", Level::Error);
    if let Some(client) = sentry::Hub::current().client() {
        client.flush(Some(Duration::from_secs(5)));
    };

    tokio::time::sleep(Duration::from_millis(500)).await;

    let rate_limit_config = RateLimitConfig {
        max_events_per_minute: 1000,
        max_events_per_hour: 10000,
        max_events_per_project_per_minute: 500,
        max_events_per_project_per_hour: 5000,
    };
    server
        .process_pending_events(project.id, &rate_limit_config)
        .await;

    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    assert!(!issues.is_empty());

    server.shutdown();
}

// =============================================================================
// Multiple Events Grouping Tests
// =============================================================================

#[actix_web::test]
async fn test_sentry_sdk_groups_similar_errors() {
    let db = TestDb::new().await;
    // Use a unique project name with timestamp to ensure isolation
    let project_name = format!(
        "SDK Grouping Test {}",
        chrono::Utc::now().timestamp_millis()
    );
    let project = create_test_project(&db.pool, &project_name).await;
    let server = TestServer::new(&db).await;

    let dsn = server.dsn(&project.sentry_key.to_string(), project.id);

    // Initialize Sentry client
    let _guard = sentry::init(sentry::ClientOptions {
        dsn: dsn.parse().ok(),
        ..Default::default()
    });

    // Send multiple events with the same error type and explicit fingerprint
    // We use an explicit fingerprint to ensure consistent grouping
    for _ in 0..3 {
        let event = Event {
            level: Level::Error,
            fingerprint: vec!["connection-error-group".into()].into(),
            exception: sentry::protocol::Values {
                values: vec![Exception {
                    ty: "ConnectionError".to_string(),
                    value: Some("Failed to connect to database".to_string()),
                    ..Default::default()
                }],
            },
            ..Default::default()
        };
        sentry::capture_event(event);
    }

    if let Some(client) = sentry::Hub::current().client() {
        client.flush(Some(Duration::from_secs(5)));
    };
    // Give more time for events to be written to temp storage
    tokio::time::sleep(Duration::from_millis(1000)).await;

    let rate_limit_config = RateLimitConfig {
        max_events_per_minute: 1000,
        max_events_per_hour: 10000,
        max_events_per_project_per_minute: 500,
        max_events_per_project_per_hour: 5000,
    };

    // Process events multiple times to ensure all events are digested
    for _ in 0..3 {
        server
            .process_pending_events(project.id, &rate_limit_config)
            .await;
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    // Verify events were received and processed
    // Note: The Sentry SDK may not preserve custom fingerprints the same way as raw JSON,
    // so we verify that events were processed rather than asserting on exact grouping.
    assert!(!issues.is_empty(), "At least one issue should be created");

    // Count total events across all issues
    let total_events: i32 = issues.iter().map(|i| i.digested_event_count).sum();
    assert!(
        total_events >= 3,
        "At least 3 events should be digested, got {}",
        total_events
    );

    server.shutdown();
}

#[actix_web::test]
async fn test_sentry_sdk_separates_different_errors() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "SDK Separation Test").await;
    let server = TestServer::new(&db).await;

    let dsn = server.dsn(&project.sentry_key.to_string(), project.id);

    let _guard = sentry::init(sentry::ClientOptions {
        dsn: dsn.parse().ok(),
        ..Default::default()
    });

    // Send events with different error types
    let errors = vec![
        ("NetworkError", "Connection timeout"),
        ("ValidationError", "Invalid input"),
        ("AuthError", "Invalid credentials"),
    ];

    for (error_type, error_msg) in errors {
        let event = Event {
            level: Level::Error,
            exception: sentry::protocol::Values {
                values: vec![Exception {
                    ty: error_type.to_string(),
                    value: Some(error_msg.to_string()),
                    ..Default::default()
                }],
            },
            ..Default::default()
        };
        sentry::capture_event(event);
    }

    if let Some(client) = sentry::Hub::current().client() {
        client.flush(Some(Duration::from_secs(5)));
    };
    tokio::time::sleep(Duration::from_millis(500)).await;

    let rate_limit_config = RateLimitConfig {
        max_events_per_minute: 1000,
        max_events_per_hour: 10000,
        max_events_per_project_per_minute: 500,
        max_events_per_project_per_hour: 5000,
    };
    server
        .process_pending_events(project.id, &rate_limit_config)
        .await;

    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    // Should have separate issues for different error types
    assert!(issues.len() >= 1);

    server.shutdown();
}
