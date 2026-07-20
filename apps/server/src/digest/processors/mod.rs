pub mod event;
pub mod logs;
pub mod session;
pub mod span;
pub mod span_v2;
pub mod transaction;

pub use event::ErrorProcessor;
pub use logs::LogsProcessor;
pub use session::{SessionItem, SessionProcessor};
pub use span::SpanProcessor;
pub use span_v2::SpanV2Processor;
pub use transaction::TransactionProcessor;

use crate::config::RateLimitConfig;
use crate::db::DbPool;
use crate::error::AppResult;
use crate::ingest::envelope::EnvelopeItemKind;
use crate::services::sourcemap::SourceMapProvider;
use crate::workers::session_aggregator::SessionAggregatorHandle;
use chrono::{DateTime, Utc};
use std::path::PathBuf;
use std::sync::Arc;
use uuid::Uuid;

/// The processor registry: one instance per processor, built once at startup
/// and shared as application state. Mirrors Relay's `inner.processing` struct
/// (relay-server/src/services/processor.rs) — each processor owns the
/// dependencies it needs; per-request values travel in [`ProcessorCtx`].
///
/// This is the single dispatch surface for the ingest pipeline. Adding a new
/// item type means adding a field here, a [`Route`] variant, and a `match` arm
/// — the compiler enforces the rest.
pub struct Processors {
    pub errors: ErrorProcessor,
    pub transactions: TransactionProcessor,
    pub sessions: SessionProcessor,
    pub logs: LogsProcessor,
    pub spans: SpanProcessor,
    pub spans_v2: SpanV2Processor,
}

impl Processors {
    pub fn new(
        ingest_dir: PathBuf,
        rate_limit_config: RateLimitConfig,
        sourcemap_provider: Arc<dyn SourceMapProvider>,
        session_aggregator: Option<SessionAggregatorHandle>,
    ) -> Self {
        Self {
            errors: ErrorProcessor::new(ingest_dir, rate_limit_config, sourcemap_provider),
            transactions: TransactionProcessor,
            sessions: SessionProcessor::new(session_aggregator),
            logs: LogsProcessor,
            spans: SpanProcessor,
            spans_v2: SpanV2Processor,
        }
    }
}

/// A processor for one category of envelope work.
///
/// One impl per [`Route`]. Mirrors Relay's `Processor` trait
/// (relay-server/src/processing/mod.rs): static dispatch, no `dyn`.
///
/// The return type is spelled `impl Future + Send` (RPITIT) rather than a bare
/// `async fn` so the future is guaranteed `Send` — processors run inside
/// `tokio::spawn` — and to avoid the `async_fn_in_trait` lint under `-D warnings`.
pub trait Processor {
    /// The unit of work this processor consumes (extracted from an `EnvelopeItemKind`).
    type Input;

    /// Process one unit of work. Errors are logged by the caller and never
    /// abort sibling items in the same envelope.
    fn process(
        &self,
        work: Self::Input,
        ctx: &ProcessorCtx,
    ) -> impl std::future::Future<Output = AppResult<()>> + Send;
}

/// Identifies which processor handles a given envelope item.
///
/// Pure routing — no DB, no side effects. This is the single source of truth
/// for "which processor owns this item type", mirroring Relay's
/// `ProcessingGroup` (relay-server/src/services/processor.rs).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Route {
    /// Error/exception events — durable two-phase digest (temp file + worker).
    Error,
    /// Performance transactions — direct store, no grouping.
    Transaction,
    /// Session health updates and aggregates.
    Session,
    /// Standalone logs — direct store, no grouping.
    Log,
    /// Standalone spans — direct store, no grouping.
    Span,
    /// Standalone spans, Spans Protocol v2 (batched container) — direct
    /// store, no grouping.
    SpanV2,
    /// Forward-compatible catch-all: logged and dropped, never processed.
    Ignored,
}

/// Maps an envelope item to the processor that owns it.
///
/// Exhaustiveness is compiler-enforced: a new `EnvelopeItemKind` variant
/// without a route arm is a build error, never a silent drop.
pub fn route(item: &EnvelopeItemKind) -> Route {
    match item {
        EnvelopeItemKind::Event(_) => Route::Error,
        EnvelopeItemKind::Transaction(_) => Route::Transaction,
        EnvelopeItemKind::Session(_) | EnvelopeItemKind::Sessions(_) => Route::Session,
        EnvelopeItemKind::Log(_) => Route::Log,
        EnvelopeItemKind::Span(_) => Route::Span,
        EnvelopeItemKind::SpanV2Batch(_) => Route::SpanV2,
        EnvelopeItemKind::Other(_, _) => Route::Ignored,
    }
}

/// Shared context injected into all processors.
/// Add new fields here — not to individual processor signatures.
pub struct ProcessorCtx {
    pub pool: DbPool,
    pub project_id: i32,
    pub event_id: Uuid,
    pub ingested_at: DateTime<Utc>,
    pub remote_addr: Option<String>,
}
