-- Revert alerting system tables
DROP TABLE IF EXISTS alert_history;
DROP TABLE IF EXISTS alert_rule_channels;
DROP TABLE IF EXISTS alert_rules;
DROP TABLE IF EXISTS notification_channels;
