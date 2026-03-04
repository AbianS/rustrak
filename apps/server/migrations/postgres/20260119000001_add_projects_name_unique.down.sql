-- Remove UNIQUE constraint on name
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_name_key;
