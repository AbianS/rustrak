//! Common test utilities and helpers
//!
//! This module provides shared functionality for all tests.

#![allow(unused_imports, dead_code)]

pub mod db;
pub mod fixtures;

pub use db::TestDb;
pub use fixtures::{create_envelope, create_envelope_no_length, EventBuilder, StackFrame};

use rustrak::error::AppResult;
use rustrak::services::sourcemap::{SourceMapEntry, SourceMapProvider};
use std::sync::Arc;

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
