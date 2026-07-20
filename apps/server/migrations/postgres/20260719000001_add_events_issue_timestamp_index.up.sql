-- no-transaction
--
-- Backs the new (timestamp, id) keyset pagination in
-- EventService::list_paginated (see 20260719000000_drop_event_digest_order
-- for why events no longer order by digest_order). `timestamp` is the
-- SDK-reported event time (matches Sentry's own per-event ordering), not
-- `ingested_at`.
--
-- CONCURRENTLY (hence `-- no-transaction`, alone in its own file --
-- precedent: 20260718000000_agent_perf_indexes / 20260718000001) lets
-- ingestion keep writing while the index builds on a large existing table.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_issue_timestamp
    ON events (issue_id, timestamp DESC, id DESC);
