---
title: 'Alert Two-Tier Integrations — Backend (DB + Rust)'
type: 'feature'
created: '2026-05-21'
status: 'in-review'
baseline_commit: '384671d1a0bb725b4bc633d407d6e3cf41836c76'
specLoopIteration: 3
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

- `apps/server/migrations/postgres/20260521131726_alert_integrations.up.sql` -- new migration (up)
- `apps/server/migrations/postgres/20260521131726_alert_integrations.down.sql` -- new migration (down)
- `apps/server/src/models/alert.rs` -- all alert model types
- `apps/server/src/services/notification/mod.rs` -- `NotificationDispatcher` trait + factory
- `apps/server/src/services/notification/slack.rs` -- Slack dispatcher
- `apps/server/src/services/notification/email.rs` -- Email dispatcher
- `apps/server/src/services/notification/webhook.rs` -- Webhook dispatcher
- `apps/server/src/services/alert.rs` -- `AlertService` dispatch logic
- `apps/server/src/routes/alerts.rs` -- HTTP handlers + DTOs

## Tasks & Acceptance

**Execution:**
- [x] `apps/server/migrations/postgres/20260521131726_alert_integrations.up.sql` -- CREATE `alert_integrations` table; INSERT from `notification_channels` (extract credentials by provider — KEEP: SQL extraction logic from SCL-1); for `alert_rule_channels`: **use `ALTER TABLE ... RENAME COLUMN channel_id TO integration_id`** (NOT add+drop — SCL-1), then DROP old FK constraint on channel_id `IF EXISTS`, ADD new FK constraint `integration_id REFERENCES alert_integrations(id) ON DELETE CASCADE`, **DROP CONSTRAINT alert_rule_channels_pkey** then **ADD PRIMARY KEY (alert_rule_id, integration_id)**; backfill `routing_override` per provider BEFORE dropping `notification_channels` (KEEP: backfill SQL from SCL-1); same RENAME COLUMN approach for `alert_history.channel_id → integration_id` + FK update; DROP `notification_channels`
- [x] `apps/server/migrations/postgres/20260521131726_alert_integrations.down.sql` -- reverse migration: recreate `notification_channels`, restore junction columns, drop `alert_integrations`
- [x] `apps/server/src/models/alert.rs` -- rename `NotificationChannel` → `AlertIntegration`, field `channel_type` → `provider_type`; add flat structs `SlackRoutingOverride { channel: Option<String>, username: Option<String>, icon_emoji: Option<String> }`, `EmailRoutingOverride { recipients: Vec<String> }`, `WebhookRoutingOverride { url: Option<String>, extra_headers: Option<HashMap<String,String>> }` — **NO `#[serde(tag)]` on any routing struct** (SCL-1 — routing JSON never carries a `provider_type` discriminator); add `AlertRuleChannel { alert_rule_id, integration_id, routing_override: serde_json::Value }` struct; update `AlertHistory` field `channel_id` → `integration_id`
- [x] `apps/server/src/services/notification/mod.rs` + `slack.rs` + `email.rs` + `webhook.rs` -- update `NotificationDispatcher::send()` to `(&AlertIntegration, routing: &serde_json::Value, &AlertPayload)`; each dispatcher calls `serde_json::from_value::<OwnRoutingOverride>(routing.clone())` directly (flat struct, no tag) — KEEP: webhook `effective_url = routing.url ?? credentials.url` merge (SCL-1); update factory to accept `ProviderType`; dispatch MUST skip (return Ok) if `integration.is_enabled == false` — add this check BEFORE calling send (SCL-1)
- [x] `apps/server/src/services/alert.rs` -- update `get_rule_channels` query: `SELECT arc.integration_id, arc.routing_override FROM alert_rule_channels arc INNER JOIN alert_integrations i ON arc.integration_id = i.id WHERE arc.alert_rule_id = $1 AND i.is_enabled = TRUE` — KEEP the is_enabled filter (SCL-1, was lost in first attempt); update `dispatch_to_channel` to accept `&AlertRuleChannel`; update `AlertHistory` insert to use `integration_id`
- [x] `apps/server/src/routes/alerts.rs` -- rename routes to `/api/integrations`; update DTOs; replace `channel_ids` with `channels: Vec<AlertRuleChannelInput>`; implement `validate_routing_override(provider_type, credentials, routing)` — **match on `provider_type` and deserialize into the specific flat struct** (`SlackRoutingOverride`, `EmailRoutingOverride`, `WebhookRoutingOverride`) — NOT into a tagged enum (SCL-1); for Slack bot_token: reject if channel is None or empty; for Email: reject if recipients is empty, reject if any address doesn't contain '@'; for Webhook: reject if both `credentials.url` and `routing.url` are absent, reject `routing.url` if not a valid http/https URL; call `validate_routing_override` in both create/update rule handlers AND in the test endpoint before dispatch

**Acceptance Criteria:**
- Given an existing DB with `notification_channels` data, when the server starts on the new version, then `sqlx migrate run` completes without errors and `alert_integrations` contains the same count of rows as the old `notification_channels`.
- Given a Slack bot_token integration, when two projects create alert rules linking to it with `routing_override:{channel:"#fe"}` and `routing_override:{channel:"#be"}` respectively, then each alert fires to its own channel.
- Given a webhook integration with no `url` in credentials, when a rule is created with no `routing_override.url`, then `POST /api/projects/{id}/alert-rules` returns 422.
- Given `GET /api/integrations/{id}` for a Slack bot_token integration, then the response contains `"token": "xoxb-****"`.
- Given `cargo test`, all tests pass with no regressions.
- Given a disabled integration (`is_enabled: false`), when an alert fires, then no message is dispatched to that integration.
- Given `POST /api/projects/1/alert-rules` with `routing_override:{channel:"#fe"}` for a Slack bot_token integration (no `provider_type` tag in JSON), then the route returns 201 (not 422).

## Spec Change Log

### SCL-1 — 2026-05-21 (loop 1→2)

**Triggering findings:** AA-1 (migration PRIMARY KEY drop fails), BH-2/AA-2 (RoutingOverride serde tag mismatch causes email 422 + slack/webhook validation bypass), AA-5 (is_enabled filter lost at dispatch)

**Amended sections:** Code Map (added .down.sql), Tasks (migration RENAME COLUMN approach, flat struct deserialization, is_enabled filter, URL format validation, test endpoint validation)

**Known-bad state avoided:**
1. `ALTER TABLE alert_rule_channels DROP COLUMN channel_id` fails with "column is a primary key column" — PostgreSQL requires dropping the PK constraint before dropping a PK column. Fix: use `RENAME COLUMN` instead.
2. `serde_json::from_value::<RoutingOverride>({channel:"#fe"})` fails because RoutingOverride needs `provider_type` tag — email routing always 422, slack/webhook validation silent. Fix: deserialize into flat structs (`SlackRoutingOverride`, etc.) using the known `provider_type` parameter.
3. `get_rule_channels` returned ALL rule channels including disabled integrations. Fix: add `AND i.is_enabled = TRUE` to join.

**KEEP instructions (must survive re-derivation):**
- K1: Migration credentials extraction SQL (Slack strips channel/username/icon_emoji, Email strips recipients, Webhook copies as-is) — correct
- K2: Migration routing_override backfill SQL (jsonb_strip_nulls for Slack, jsonb_build_object for Email, `{}` for webhook/slack-webhook) — correct
- K3: Flat struct field shapes for SlackRoutingOverride, EmailRoutingOverride, WebhookRoutingOverride — correct
- K4: Token redaction in route responses — correct
- K5: Webhook `effective_url = routing.url ?? credentials.url` merge in dispatcher — correct
- K6: Route rename to `/api/integrations`, AlertIntegration rename, ProviderType enum — correct
- K7: Test endpoint accepts optional routing_override body — correct

### SCL-2 — 2026-05-21 (loop 2→3)

**Triggering findings:** ECH-1/ECH-2 (validate_routing_override entirely absent — test endpoint always sends `{}` as routing, create/update rule accept any routing JSON without validation); ECH-4 (duplicate integration_id → 500 on INSERT); BH-3 (AlertRuleResponse.channel_ids field name mismatch vs integration_ids)

**Amended sections:** Tasks (add validate_routing_override implementation and wiring), Design Notes (no change — shapes already correct)

**Known-bad state avoided:**
1. `validate_routing_override` function was missing entirely — email rules could be created with no recipients, Slack bot_token rules with no channel, webhook rules with no URL anywhere. Fix: implement function + call in create_rule, update_rule, and test_channel handlers.
2. `test_channel` ignored request body — always sent `{}` as routing_override regardless of body. Fix: accept `Option<web::Json<TestIntegrationBody>>`, extract routing_override, call validate before dispatch.
3. Duplicate integration_id in channels list → PRIMARY KEY violation → 500. Fix: dedup by integration_id (keep first) before INSERT loop in both create_rule and update_rule service methods.
4. `AlertRuleResponse.channel_ids` serialized as `channel_ids` in JSON — clients expecting `integration_ids`. Fix: rename field to `integration_ids`.

**KEEP instructions (must survive re-derivation):**
- K1–K7: all still correct from SCL-1
- K8: validate_routing_override is a pure function `(provider_type, credentials, routing) -> AppResult<()>` — no DB access, match on provider_type, flat struct deserialization — correct
- K9: TestIntegrationBody has `routing_override: Option<serde_json::Value>` — correct
- K10: Dedup uses HashSet on integration_id, keep first occurrence — correct

## Design Notes

**routing_override shapes (authoritative — NO `provider_type` discriminator field in JSON):**

```
slack/webhook   credentials: { method, webhook_url }          routing: {}
slack/bot_token credentials: { method, token }                routing: { channel (req), username?, icon_emoji? }
email           credentials: { smtp_host, smtp_port,          routing: { recipients: string[] (req, each must contain '@') }
                               smtp_username, smtp_password,
                               from_address }
webhook         credentials: { url?, secret?, headers? }      routing: { url? (http/https only), extra_headers? }
```

**Critical: routing_override JSON carries NO `provider_type` field.** The provider type is already known from the integration record. `validate_routing_override` must use `match provider_type` and deserialize into the appropriate flat struct — NOT a serde-tagged enum.

**Migration column rename (RENAME COLUMN, not ADD+DROP):**
```sql
-- alert_rule_channels
ALTER TABLE alert_rule_channels DROP CONSTRAINT alert_rule_channels_channel_id_fkey;  -- IF EXISTS
-- backfill routing_override HERE (join to notification_channels before it's dropped)
ALTER TABLE alert_rule_channels RENAME COLUMN channel_id TO integration_id;
ALTER TABLE alert_rule_channels DROP CONSTRAINT alert_rule_channels_pkey;
ALTER TABLE alert_rule_channels ADD PRIMARY KEY (alert_rule_id, integration_id);
ALTER TABLE alert_rule_channels ADD CONSTRAINT alert_rule_channels_integration_id_fkey
  FOREIGN KEY (integration_id) REFERENCES alert_integrations(id) ON DELETE CASCADE;

-- alert_history (same pattern)
ALTER TABLE alert_history DROP CONSTRAINT alert_history_channel_id_fkey;  -- IF EXISTS
ALTER TABLE alert_history RENAME COLUMN channel_id TO integration_id;
ALTER TABLE alert_history ADD CONSTRAINT alert_history_integration_id_fkey
  FOREIGN KEY (integration_id) REFERENCES alert_integrations(id) ON DELETE SET NULL;
```

**Migration credentials extraction SQL (KEEP — correct from SCL-1):**

```sql
-- Slack bot_token
credentials = config - 'channel' - 'username' - 'icon_emoji'
routing_override = jsonb_strip_nulls(jsonb_build_object(
  'channel', config->>'channel', 'username', config->>'username', 'icon_emoji', config->>'icon_emoji'))

-- Email
credentials = config - 'recipients'
routing_override = jsonb_build_object('recipients', config->'recipients')

-- Slack webhook + generic webhook
credentials = config
routing_override = '{}'::jsonb
```

## Verification

**Commands:**
- `cd apps/server && cargo build` -- expected: zero compile errors
- `cd apps/server && cargo test` -- expected: all tests pass
- `cd apps/server && cargo clippy -- -D warnings` -- expected: zero warnings
