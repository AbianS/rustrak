-- Language and timezone the reader has chosen for the dashboard.
--
-- Nullable on purpose: NULL means "has not chosen", which is a different state
-- from "chose English". The dashboard falls back to Accept-Language for the
-- first, and must not for the second.
--
-- Not constrained to a list of locales. The server is an API that can run
-- without the dashboard, so it has no business knowing which languages that
-- dashboard ships; it validates the shape and lets the consumer decide what it
-- recognises.
ALTER TABLE users ADD COLUMN language TEXT;
ALTER TABLE users ADD COLUMN timezone TEXT;
