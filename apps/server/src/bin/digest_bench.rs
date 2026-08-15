//! Quick processor-level perf probe for the SQLite write path: drives the
//! production digest ([`ErrorProcessor`]) over a throwaway file-backed
//! SQLite and prints events/s. The CI `quick-bench` job compares head vs
//! target-branch head on the same runner — fail >2× slower, warn >1.5× —
//! catching order-of-magnitude regressions; the ratio cancels runner noise.
//! Covers the stacked hot path: temp-file write/read, parse, grouping,
//! issue create/reuse, one tx (event + counters), quota state, cleanup.
//! The probe applies the production SQLite settings (WAL, synchronous
//! NORMAL, 500ms busy timeout) so it measures the shipped write path.
//! SQLite-only; `required-features = ["bench"]` keeps `--all-targets`
//! builds clean.

use std::sync::Arc;
use std::time::Instant;

use chrono::Utc;
use rustrak::config::RateLimitConfig;
use rustrak::digest::processors::{ErrorProcessor, Processor, ProcessorCtx};
use rustrak::ingest::envelope::EventMetadata;
use rustrak::ingest::storage::store_event;
use rustrak::models::CreateProject;
use rustrak::services::sourcemap::DbSourceMapProvider;
use rustrak::services::sourcemap_store::LocalSourceMapStore;
use rustrak::services::ProjectService;
use serde_json::json;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};
use std::str::FromStr;
use std::time::Duration;
use tempfile::tempdir;
use uuid::Uuid;

fn lenient_config() -> RateLimitConfig {
    RateLimitConfig {
        max_events_per_minute: 1_000_000,
        max_events_per_hour: 10_000_000,
        max_events_per_project_per_minute: 1_000_000,
        max_events_per_project_per_hour: 10_000_000,
    }
}

fn ctx(pool: &rustrak::db::DbPool, project_id: i32) -> ProcessorCtx {
    ProcessorCtx {
        pool: pool.clone(),
        project_id,
        event_id: Uuid::nil(),
        ingested_at: Utc::now(),
        remote_addr: None,
    }
}

#[tokio::main]
async fn main() {
    env_logger::init();

    let events: usize = std::env::var("BENCH_EVENTS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(200);

    let dir = tempdir().expect("create bench dir");
    // Production write path: WAL + synchronous(NORMAL) + 500ms busy timeout,
    // exactly what db::connect applies to the running server.
    let opts = SqliteConnectOptions::from_str(&format!(
        "sqlite://{}",
        dir.path().join("bench.db").display()
    ))
    .expect("parse sqlite url")
    .create_if_missing(true)
    .journal_mode(SqliteJournalMode::Wal)
    .synchronous(SqliteSynchronous::Normal)
    .busy_timeout(Duration::from_millis(500));
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(opts)
        .await
        .expect("open sqlite");
    sqlx::migrate!("./migrations/sqlite")
        .run(&pool)
        .await
        .expect("migrate");

    let project = ProjectService::create(
        &pool,
        CreateProject {
            name: "bench".to_string(),
            slug: None,
            platform: None,
        },
    )
    .await
    .expect("create project");

    let ingest_dir = dir.path().join("ingest");
    std::fs::create_dir_all(&ingest_dir).expect("create ingest dir");

    // The real provider over an empty store: a fast miss, as in a fresh
    // deployment (events without stacktrace frames never call it).
    let provider = DbSourceMapProvider::new(
        pool.clone(),
        Arc::new(LocalSourceMapStore::new(dir.path().join("sourcemaps"))),
    );
    let processor = ErrorProcessor::new(ingest_dir.clone(), lenient_config(), Arc::new(provider));
    let ctx = ctx(&pool, project.id);

    // 20 distinct messages cycle, so both the new-issue and existing-issue
    // digest paths run — a burst is many events over few issues.
    let messages: Vec<String> = (0..20).map(|i| format!("TypeError: boom {i}")).collect();

    let start = Instant::now();
    for i in 0..events {
        let event_id = Uuid::new_v4().to_string();
        let body = serde_json::to_vec(&json!({
            "event_id": event_id,
            "message": messages[i % messages.len()],
            "level": "error",
            "platform": "python",
            "timestamp": Utc::now().to_rfc3339(),
        }))
        .expect("serialize event");
        store_event(&ingest_dir, &event_id, &body)
            .await
            .expect("store event file");
        let metadata = EventMetadata {
            event_id: event_id.clone(),
            project_id: project.id,
            ingested_at: Utc::now(),
            remote_addr: None,
        };
        processor
            .process(metadata, &ctx)
            .await
            .expect("digest event");
    }
    let elapsed = start.elapsed();

    println!(
        "digest: {events} events in {:.0}ms = {:.1} events/s",
        elapsed.as_millis(),
        events as f64 / elapsed.as_secs_f64()
    );
}
