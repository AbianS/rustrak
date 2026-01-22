-- Remove quota fields from projects
ALTER TABLE projects DROP COLUMN IF EXISTS quota_exceeded_until;
ALTER TABLE projects DROP COLUMN IF EXISTS quota_exceeded_reason;
ALTER TABLE projects DROP COLUMN IF EXISTS next_quota_check;

-- Drop installation table
DROP TABLE IF EXISTS installation;
