-- Migration: Custom Webhook provider type
--
-- Adds a fourth integration provider: `custom_webhook`, whose request body is
-- rendered from a user-supplied template (see notification/custom_webhook.rs).
-- Only the provider_type CHECK constraint needs widening; credentials stay
-- free-form JSONB with no DB-level shape constraint.

ALTER TABLE alert_integrations
    DROP CONSTRAINT IF EXISTS alert_integrations_provider_type_check;

ALTER TABLE alert_integrations
    ADD CONSTRAINT alert_integrations_provider_type_check
    CHECK (provider_type IN ('slack', 'email', 'webhook', 'custom_webhook'));
