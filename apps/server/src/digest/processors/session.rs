use super::{Processor, ProcessorCtx};
use crate::error::AppResult;
use crate::models::session::{SessionAggregates, SessionUpdate};
use crate::workers::session_aggregator::SessionAggregatorHandle;

/// A session envelope item: either a single update or a pre-aggregated batch.
pub enum SessionItem {
    Update(SessionUpdate),
    Aggregates(SessionAggregates),
}

/// Processes session items by forwarding them to the in-process aggregator.
///
/// Owns its dependency (the aggregator handle) — mirrors Relay's registry,
/// where each processor carries the deps it needs rather than fattening the
/// shared [`ProcessorCtx`]. When no aggregator is configured, processing is a
/// safe no-op (session tracking is optional).
pub struct SessionProcessor {
    aggregator: Option<SessionAggregatorHandle>,
}

impl SessionProcessor {
    pub fn new(aggregator: Option<SessionAggregatorHandle>) -> Self {
        Self { aggregator }
    }
}

impl Processor for SessionProcessor {
    type Input = SessionItem;

    async fn process(&self, work: SessionItem, ctx: &ProcessorCtx) -> AppResult<()> {
        if let Some(agg) = &self.aggregator {
            match work {
                SessionItem::Update(update) => {
                    agg.ingest_session(ctx.project_id, &update).await;
                }
                SessionItem::Aggregates(aggregates) => {
                    agg.ingest_aggregates(ctx.project_id, &aggregates).await;
                }
            }
            agg.flush().await?;
        }
        Ok(())
    }
}
