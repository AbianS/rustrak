-- Revert remote_addr column from TEXT back to INET
ALTER TABLE events ALTER COLUMN remote_addr TYPE INET USING remote_addr::inet;
