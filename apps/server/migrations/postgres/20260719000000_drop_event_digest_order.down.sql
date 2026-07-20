-- Reverse of the up migration -- intentionally NOT safe to run against a
-- populated table with any issue that has more than one event.
--
-- Every existing row gets the same placeholder digest_order (1), then the
-- UNIQUE(issue_id, digest_order) constraint is rebuilt. Building that
-- constraint validates the existing data: it aborts (23505) the instant it
-- finds two rows sharing the same (issue_id, digest_order) pair -- which
-- happens immediately for any issue with more than one event, since they
-- all just got the same placeholder. An issue with at most one event rolls
-- back cleanly, because there's no ambiguity to collapse -- its one event's
-- digest_order really was 1.
--
-- This is deliberate: silently collapsing every issue's event ordering to a
-- placeholder would be a silent data-loss rollback path. Failing loudly here
-- matches the documented contract (see the spec's I/O & Edge-Case Matrix) --
-- this down-migration is for fresh/empty-test-db rollbacks only, not for
-- reverting a database with real event history.
ALTER TABLE events ADD COLUMN digest_order INTEGER NOT NULL DEFAULT 1;
ALTER TABLE events ADD CONSTRAINT events_issue_id_digest_order_key UNIQUE (issue_id, digest_order);
