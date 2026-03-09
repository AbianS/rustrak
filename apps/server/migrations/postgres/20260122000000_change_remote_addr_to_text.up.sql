-- Change remote_addr column from INET to TEXT for cross-database compatibility
-- The application now stores remote addresses as plain strings
ALTER TABLE events ALTER COLUMN remote_addr TYPE TEXT USING remote_addr::text;
