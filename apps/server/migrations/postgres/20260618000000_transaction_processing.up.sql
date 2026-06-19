-- Transaction processing: typed dispatch + nullable issue/grouping refs
ALTER TABLE events
    ALTER COLUMN issue_id    DROP NOT NULL,
    ALTER COLUMN grouping_id DROP NOT NULL,
    ADD COLUMN event_type      VARCHAR(20) NOT NULL DEFAULT 'error',
    ADD COLUMN start_timestamp TIMESTAMPTZ,
    ADD COLUMN spans           JSONB;

CREATE INDEX idx_events_event_type ON events(project_id, event_type);
