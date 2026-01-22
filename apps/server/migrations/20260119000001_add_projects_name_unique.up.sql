-- Add UNIQUE constraint on name if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'projects_name_key'
    ) THEN
        ALTER TABLE projects ADD CONSTRAINT projects_name_key UNIQUE (name);
    END IF;
END $$;
