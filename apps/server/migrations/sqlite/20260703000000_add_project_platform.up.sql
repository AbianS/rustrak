-- Sentry-parity project platform auto-detection.
-- Mirrors sentry.models.project.Project.platform: nullable, set once by the
-- digest pipeline from the first valid event.platform seen, never overwritten.
ALTER TABLE projects ADD COLUMN platform VARCHAR(50);
