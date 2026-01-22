-- Revert initial schema (in reverse order of creation)

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS schema_info;
