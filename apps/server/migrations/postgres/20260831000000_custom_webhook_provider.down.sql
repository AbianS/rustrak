-- Restore the three-value provider_type CHECK.
--
-- custom_webhook rows cannot satisfy the old constraint, and a rolled-back
-- build has no dispatcher for them, so they are deleted (child rows cascade:
-- alert_rule_channels ON DELETE CASCADE, alert_history ON DELETE SET NULL).
DELETE FROM alert_integrations WHERE provider_type = 'custom_webhook';

ALTER TABLE alert_integrations
    DROP CONSTRAINT IF EXISTS alert_integrations_provider_type_check;

ALTER TABLE alert_integrations
    ADD CONSTRAINT alert_integrations_provider_type_check
    CHECK (provider_type IN ('slack', 'email', 'webhook'));
