-- Issue activity log, comments (as notes), bookmarks, subscriptions,
-- read-tracking, and user reports (GH #165). UUIDs are app-generated.

CREATE TABLE issue_activity (
    id TEXT PRIMARY KEY,
    issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(32) NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_issue_activity_issue ON issue_activity(issue_id, created_at DESC);

CREATE TABLE issue_bookmarks (
    issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (issue_id, user_id)
);

CREATE TABLE issue_subscriptions (
    issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(32) NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (issue_id, user_id)
);

CREATE TABLE issue_seen (
    issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (issue_id, user_id)
);

CREATE TABLE user_reports (
    id TEXT PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    issue_id TEXT REFERENCES issues(id) ON DELETE SET NULL,
    event_id TEXT,
    name VARCHAR(255) NOT NULL DEFAULT '',
    email VARCHAR(255) NOT NULL DEFAULT '',
    comments TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_user_reports_issue ON user_reports(issue_id, created_at DESC);
CREATE INDEX idx_user_reports_project ON user_reports(project_id, created_at DESC);
