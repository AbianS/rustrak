---
title: 'Alert Two-Tier Integrations — Backend (DB + Rust)'
type: 'feature'
created: '2026-05-21'
status: 'in-progress'
baseline_commit: '384671d1a0bb725b4bc633d407d6e3cf41836c76'
context:
  - '_bmad-output/implementation-artifacts/investigations/alert-two-tier-config-investigation.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `notification_channels` collapses provider credentials and per-project routing into one record — to send Slack alerts to 3 different channels you must create 3 records with the same bot token; credentials are duplicated and unreusable across projects.

**Approach:** Introduce `alert_integrations` (global credentials only) and add `routing_override JSONB` to the `alert_rule_channels` junction (per-rule routing). Migrate all existing data non-destructively. Rename API routes from `/api/alert-channels` to `/api/integrations`. Frontend + client package update is deferred (D-11, D-12).

## Boundaries & Constraints

**Always:**
- Implementation must follow the `/tdd` skill workflow — write failing tests first, then make them pass. No task is complete until its tests are green.
- Migration is non-destructive: every existing channel record becomes an integration row with credentials extracted; routing fields move to junction `routing_override`. No data lost.
- `alert_history` FK validity preserved: rename `channel_id` → `integration_id`, backfill from migrated IDs (IDs are kept identical so FK references stay valid).
- Webhook: global `url` in credentials is optional; per-rule `routing_override.url` is required when credentials lacks a URL — validate at rule-create time (not dispatch time).
- Slack bot_token `routing_override` must contain a non-empty `channel`. Slack webhook `routing_override` is always `{}`.
- Email `routing_override` must contain `recipients` with at least one address.
- Redact `xoxb-*` tokens in all `GET /api/integrations` responses (existing `redact_slack_bot_token` pattern).
- Test endpoint `POST /api/integrations/{id}/test` accepts optional `routing_override` body.

**Ask First:**
- If a routing_override shape for an existing provider needs to change after the spec is approved (e.g. adding `username` field to webhook), confirm with user before modifying frozen section.

**Never:**
- Remove `alert_history` rows during migration.
- Change the dispatch retry / exponential backoff logic — out of scope.
- Add OFFSET pagination.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create Slack bot_token integration | `POST /api/integrations` `{name:"Slack Prod", provider_type:"slack", credentials:{method:"bot_token", token:"xoxb-…"}}` | 201, token redacted as `"xoxb-****"` in response | 422 if token missing `xoxb-` prefix |
| Create rule with routing override | `POST /api/projects/1/alert-rules` `{channels:[{integration_id:5, routing_override:{channel:"#fe"}}]}` | Rule + junction row created | 422 if `integration_id` not found or `routing_override` invalid for provider type |
| Alert fires — Slack bot_token | Integration `{method:"bot_token",token}` + routing `{channel:"#fe"}` | Slack message posted to `#fe` | History failure row, `failure_count++` |
| Alert fires — Webhook no global URL | Integration `{secret:"abc"}` (no url) + routing `{url:"https://svc.io/hook"}` | POST to routing url with HMAC | 422 at rule-create if both absent |
| Alert fires — Email | Integration `{smtp_host,…}` + routing `{recipients:["a@b.com"]}` | Email sent to `a@b.com` | History failure row on SMTP error |
| Migration on upgrade | DB has old `notification_channels` + `alert_rule_channels.channel_id` | Tables renamed/restructured, FKs updated, all existing rules still fire | Migration rolls back on error |

</frozen-after-approval>

## Code Map

- `apps/server/migrations/postgres/20260521131726_alert_integrations.up.sql` -- new migration
- `apps/server/src/models/alert.rs` -- all alert model types
- `apps/server/src/services/notification/mod.rs` -- `NotificationDispatcher` trait + factory
- `apps/server/src/services/notification/slack.rs` -- Slack dispatcher
- `apps/server/src/services/notification/email.rs` -- Email dispatcher
- `apps/server/src/services/notification/webhook.rs` -- Webhook dispatcher
- `apps/server/src/services/alert.rs` -- `AlertService` dispatch logic
- `apps/server/src/routes/alerts.rs` -- HTTP handlers + DTOs

## Tasks & Acceptance

**Execution:**
- [x] `apps/server/migrations/postgres/20260521131726_alert_integrations.up.sql` -- CREATE `alert_integrations` (id, name, provider_type CHECK('slack','email','webhook'), credentials JSONB, is_enabled, failure_count, last_failure_at, last_failure_message, last_success_at, created_at, updated_at); INSERT from `notification_channels` — extract credentials JSONB per provider type (strip routing fields: Slack bot_token strips `channel/username/icon_emoji`, Email strips `recipients`, others copy as-is); ALTER `alert_rule_channels` rename `channel_id` → `integration_id`, add FK to `alert_integrations`, add `routing_override JSONB NOT NULL DEFAULT '{}'::jsonb`, backfill `routing_override` per provider; ALTER `alert_history` rename `channel_id` → `integration_id`, update FK; DROP `notification_channels` -- preserves all IDs so existing FK references remain valid
- [x] `apps/server/src/models/alert.rs` -- rename `NotificationChannel` → `AlertIntegration`, field `channel_type` → `provider_type`; add `RoutingOverride` as serde-tagged enum: `Slack { channel?, username?, icon_emoji? }` | `Email { recipients: Vec<String> }` | `Webhook { url?: String, extra_headers?: HashMap<String,String> }`; add `AlertRuleChannel { alert_rule_id, integration_id, routing_override: serde_json::Value }` struct; update `AlertHistory` field `channel_id` → `integration_id`
- [x] `apps/server/src/services/notification/mod.rs` + `slack.rs` + `email.rs` + `webhook.rs` -- update `NotificationDispatcher::send()` signature to `(&AlertIntegration, routing: &serde_json::Value, &AlertPayload)`; each dispatcher deserializes routing into its own override type; Slack bot_token reads `routing.channel`; Email reads `routing.recipients`; Webhook computes `effective_url = routing.url ?? credentials.url`, merges `routing.extra_headers` into credentials headers; update `create_dispatcher` factory to accept `ProviderType`
- [x] `apps/server/src/services/alert.rs` -- update `get_rule_channels` query to `SELECT integration_id, routing_override FROM alert_rule_channels WHERE alert_rule_id=$1`; update `dispatch_to_channel` to accept `&AlertRuleChannel`, fetch `AlertIntegration` by `integration_id`, pass `(integration, &rule_channel.routing_override, payload)` to dispatcher; update `AlertHistory` insert field name to `integration_id`
- [x] `apps/server/src/routes/alerts.rs` -- rename all route paths from `/api/alert-channels` to `/api/integrations`; rename DTOs `CreateNotificationChannel` → `CreateAlertIntegration`, `UpdateNotificationChannel` → `UpdateAlertIntegration`; replace `channel_ids: Vec<i32>` in alert rule DTOs with `channels: Vec<AlertRuleChannelInput { integration_id: i32, routing_override: serde_json::Value }>`; validate routing_override shape per `provider_type` in create/update rule handlers before DB insert; update test handler to accept optional `routing_override` body

**Acceptance Criteria:**
- Given an existing DB with `notification_channels` data, when the server starts on the new version, then `sqlx migrate run` completes without errors and `alert_integrations` contains the same count of rows as the old `notification_channels`.
- Given a Slack bot_token integration, when two projects create alert rules linking to it with `routing_override.channel = "#fe"` and `"#be"` respectively, then each alert fires to its own channel.
- Given a webhook integration with no `url` in credentials, when a rule is created without `routing_override.url`, then `POST /api/projects/{id}/alert-rules` returns 422.
- Given `GET /api/integrations/{id}` for a Slack bot_token integration, then the response contains `"token": "xoxb-****"`.
- Given `cargo test`, all existing tests pass (no regressions from rename).

## Design Notes

**routing_override shape per provider (authoritative for all layers):**

```
slack/webhook   credentials: { method, webhook_url }          routing: {}
slack/bot_token credentials: { method, token }                routing: { channel (req), username?, icon_emoji? }
email           credentials: { smtp_host, smtp_port, smtp_username, smtp_password, from_address }
                                                              routing: { recipients: string[] (req) }
webhook         credentials: { url?, secret?, headers? }      routing: { url?, extra_headers? }
```

**Migration extraction SQL pattern:**

```sql
-- Slack bot_token
credentials = config - 'channel' - 'username' - 'icon_emoji'
routing_override = jsonb_strip_nulls(jsonb_build_object(
  'channel', config->>'channel', 'username', config->>'username', 'icon_emoji', config->>'icon_emoji'))

-- Email
credentials = config - 'recipients'
routing_override = jsonb_build_object('recipients', config->'recipients')

-- Slack webhook + generic webhook
credentials = config  -- all stays in credentials
routing_override = '{}'::jsonb
```

## Verification

**Commands:**
- `cd apps/server && cargo build` -- expected: zero compile errors
- `cd apps/server && cargo test` -- expected: all tests pass
- `cd apps/server && cargo clippy -- -D warnings` -- expected: zero warnings
