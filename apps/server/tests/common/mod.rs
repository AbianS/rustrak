//! Common test utilities and helpers
//!
//! This module provides shared functionality for all tests.

#![allow(unused_imports, dead_code)]

pub mod db;
pub mod fixtures;

pub use db::TestDb;
pub use fixtures::{create_envelope, create_envelope_no_length, EventBuilder, StackFrame};

use rustrak::config::RateLimitConfig;
use rustrak::db::DbPool;
use rustrak::digest::processors::{ErrorProcessor, Processor, ProcessorCtx};
use rustrak::error::AppResult;
use rustrak::ingest::EventMetadata;
use rustrak::services::sourcemap::{SourceMapEntry, SourceMapProvider};
use std::path::Path;
use std::sync::Arc;
use uuid::Uuid;

/// Drives the [`ErrorProcessor`] (the production processor pattern) over an
/// event already written to the temp store. Replaces the removed
/// `worker::process_event` free function: tests exercise the exact code path
/// production uses, without rebuilding the [`ProcessorCtx`] at every call site.
pub async fn process_error_event(
    pool: &DbPool,
    metadata: &EventMetadata,
    ingest_dir: &Path,
    rate_limit_config: &RateLimitConfig,
    sourcemap_provider: Arc<dyn SourceMapProvider>,
) -> AppResult<()> {
    let processor = ErrorProcessor::new(
        ingest_dir.to_path_buf(),
        rate_limit_config.clone(),
        sourcemap_provider,
    );
    let ctx = ProcessorCtx {
        pool: pool.clone(),
        project_id: metadata.project_id,
        event_id: Uuid::parse_str(&metadata.event_id).unwrap_or_else(|_| Uuid::nil()),
        ingested_at: metadata.ingested_at,
        remote_addr: metadata.remote_addr.clone(),
    };
    processor.process(metadata.clone(), &ctx).await
}

/// No-op SourceMapProvider for tests that don't exercise source map features.
pub struct NullSourceMapProvider;

#[async_trait::async_trait]
impl SourceMapProvider for NullSourceMapProvider {
    async fn fetch_sourcemap(
        &self,
        _project_id: i32,
        _debug_id: &str,
        _file_type: &str,
    ) -> AppResult<Option<SourceMapEntry>> {
        Ok(None)
    }
}

pub fn null_sourcemap_provider() -> Arc<dyn SourceMapProvider> {
    Arc::new(NullSourceMapProvider)
}
