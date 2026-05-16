---
title: 'Slack multi-method config (webhook + bot token)'
type: 'feature'
created: '2026-05-16'
status: 'in-review'
baseline_commit: '617e45f62f55a45d480a99de7721bd43dd000930'
context:
  - 'apps/server/CLAUDE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The current `SlackConfig` only supports Incoming Webhooks, and its `channel`/`username`/`icon_emoji` fields are silently ignored by Slack — modern app-based webhooks cannot override channel or identity at runtime. Users who fill in these fields believe they work but they don't.

**Approach:** Replace `SlackConfig` with a tagged enum (`method: "webhook" | "bot_token"`). Webhook variant keeps only `webhook_url` (drop the broken fields). Bot token variant adds `token` (`xoxb-…`) + `channel` + optional `username`/`icon_emoji`, and sends via `POST https://slack.com/api/chat.postMessage`. Add a DB migration to tag existing records as `webhook`. Update the UI dialog to show the right fields per method.

## Boundaries & Constraints

**Always:**
- Webhook variant validates: HTTPS scheme + host exactly `hooks.slack.com` (existing logic, keep it)
- Bot token variant validates: token starts with `xoxb-`, channel non-empty
- For bot token: POST to `https://slack.com/api/chat.postMessage` with `Authorization: Bearer {token}` header; check `ok: true` in response JSON; map `error` field to `NotificationResult::failure`
- Migration must be backward-compatible: update existing Slack channel configs that lack a `method` field to `{"method": "webhook", ...}`
- `username` and `icon_emoji` are optional for both methods; for bot token they are silently accepted (Slack ignores them if `chat:write.customize` scope is absent — this is fine, no error)
- DB `config` column stays `jsonb` — no schema change to `notification_channels` table

**Ask First:**
- If existing live Slack channels exist in prod and the migration UPDATE would be destructive, halt and confirm
- If any existing struct field or migration numbering conflicts are found during implementation, halt and ask

**Never:**
- Do not support `xoxp-` user tokens or `xapp-` app-level tokens — only `xoxb-` bot tokens
- Do not add OAuth flow — users paste the token manually (same as API tokens in Rustrak)
- Do not change the `ChannelType` enum or `NotificationChannel` DB model
- Do not add a `channels:read` Slack API call to resolve channel names — accept channel ID or `#name` as-is

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Webhook — valid | `method: webhook`, valid URL | POST to webhook URL, `NotificationResult::success` | N/A |
| Webhook — broken channel field (legacy) | existing record `{webhook_url, channel}` after migration | `method` added, `channel` field preserved but ignored at send time | N/A |
| Bot token — valid | `method: bot_token`, `xoxb-…`, `#alerts` | POST to `chat.postMessage`, `ok: true` → success | N/A |
| Bot token — invalid token | `xoxb-wrong` | Slack returns `{"ok": false, "error": "invalid_auth"}` → `NotificationResult::failure("Slack API error: invalid_auth", 200)` | Log + store in `last_failure_message` |
| Bot token — bot not in channel | valid token, channel bot not invited | Slack returns `{"ok": false, "error": "not_in_channel"}` | `NotificationResult::failure("Bot is not a member of the channel", 200)` |
| Validation — bot token missing `xoxb-` | token `xoxa-abc` | `AppError::Validation("Slack bot token must start with xoxb-")` | Rejected at save time |
| Validation — empty channel (bot) | `channel: ""` | `AppError::Validation("Channel is required for bot token method")` | Rejected at save time |

</frozen-after-approval>

## Code Map

- `apps/server/migrations/` — new migration to backfill `method: "webhook"` on existing Slack configs
- `apps/server/src/models/alert.rs:157-166` — `SlackConfig` struct to replace with tagged enum
- `apps/server/src/services/notification/slack.rs` — entire file; add bot token send path, fix validate_config
- `apps/webview-ui/src/app/(main)/settings/alerts/alert-channels-list.tsx:83-100` — `slackFormSchema` + `SlackConfigDialog` component (~line 573)

## Tasks & Acceptance

**Execution:**
- [x] `apps/server/migrations/<timestamp>_slack_config_method_field.up.sql` -- ADD migration that UPDATEs all `notification_channels` rows where `channel_type = 'slack'` AND `config` does not contain key `method`, setting `config = config || '{"method":"webhook"}'` -- backward compat for existing records; SQLx runs all pending migrations at server startup before accepting requests, so no record without `method` will exist when the new code runs
- [x] `apps/server/src/models/alert.rs` -- REPLACE `SlackConfig` struct with `#[serde(tag = "method", rename_all = "snake_case")] pub enum SlackConfig { Webhook(SlackWebhookConfig), BotToken(SlackBotTokenConfig) }` where `SlackWebhookConfig { webhook_url: String }` and `SlackBotTokenConfig { token: String, channel: String, username: Option<String>, icon_emoji: Option<String> }` -- enables serde round-trip through `serde_json::Value` config column
- [x] `apps/server/src/services/notification/slack.rs` -- UPDATE `send()` to match on `SlackConfig` variant: webhook path keeps existing `POST webhook_url` logic (remove channel/username/icon from payload); bot token path calls `POST https://slack.com/api/chat.postMessage` with `Authorization: Bearer {token}` and parses `{ok, error}` JSON response -- fixes the broken webhook channel override and adds bot token support
- [x] `apps/server/src/services/notification/slack.rs` -- UPDATE `validate_config()` to handle both variants: webhook keeps existing URL validation; bot token checks `token.starts_with("xoxb-")` and `!channel.is_empty()` -- proper validation for both methods
- [x] `apps/webview-ui/src/app/(main)/settings/alerts/alert-channels-list.tsx` -- UPDATE `slackFormSchema` to include `method: z.enum(["webhook", "bot_token"])`, `webhook_url` (required when method=webhook), `token` (required when method=bot_token), `channel` (required when method=bot_token), `username`/`icon_emoji` (optional for bot_token only) using `.superRefine` -- aligns client validation with new server model
- [x] `apps/webview-ui/src/app/(main)/settings/alerts/alert-channels-list.tsx` -- UPDATE `SlackConfigDialog` to render method selector (radio or select: "Incoming Webhook" / "Bot Token"), show webhook URL field only for webhook method, show token + channel fields only for bot token method, remove the "Channel (optional) — Override the default channel" field from webhook form -- fixes misleading UI
- [x] `apps/server/src/routes/alerts.rs` -- UPDATE the notification channel serialization to redact the bot token before returning: if `channel_type == "slack"` and `config["method"] == "bot_token"`, replace `config["token"]` with `"xoxb-****"` in the response JSON -- prevents exposing live `xoxb-…` tokens via `GET /api/notification-channels`

**Acceptance Criteria:**
- Given an existing Slack channel with only `webhook_url` in config, when the migration runs, then the config gains `"method": "webhook"` and the channel continues to deliver alerts unchanged
- Given a new Slack channel configured with method=webhook, when the user omits the channel field (it no longer exists), then the alert is sent to the channel hardcoded in the Slack app webhook
- Given a new Slack channel configured with method=bot_token, when a valid `xoxb-…` token and channel ID are provided, then `POST chat.postMessage` is called and the alert appears in the target channel
- Given validate_config is called with `method=bot_token` and token `"xoxa-123"`, when the API endpoint is called, then the server returns 400 with `"Slack bot token must start with xoxb-"`
- Given the UI dialog for Slack, when the user selects "Bot Token" method, then the webhook URL field disappears and token + channel fields appear; when they select "Incoming Webhook", only webhook URL is shown

## Spec Change Log

## Design Notes

**Serde tagged enum for config:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "method", rename_all = "snake_case")]
pub enum SlackConfig {
    Webhook(SlackWebhookConfig),
    BotToken(SlackBotTokenConfig),
}
```
Serializes as `{"method":"webhook","webhook_url":"..."}` or `{"method":"bot_token","token":"xoxb-...","channel":"C123"}`. This round-trips cleanly through the `serde_json::Value` config column.

**Bot token send — response parsing:**
```rust
// Slack always returns HTTP 200 for the Web API; success/failure is in JSON
let body: serde_json::Value = response.json().await?;
if body["ok"].as_bool() == Some(true) {
    NotificationResult::success(Some(200))
} else {
    let err = body["error"].as_str().unwrap_or("unknown_error");
    let msg = match err {
        "not_in_channel" => "Bot is not a member of the channel".to_string(),
        "channel_not_found" => "Slack channel not found".to_string(),
        "invalid_auth" => "Invalid Slack bot token".to_string(),
        _ => format!("Slack API error: {}", err),
    };
    NotificationResult::failure(msg, Some(200))
}
```

## Verification

**Commands:**
- `cd apps/server && cargo build --features postgres` -- expected: compiles without warnings
- `cd apps/server && cargo test` -- expected: all tests pass including updated slack unit tests
- `cd apps/webview-ui && pnpm tsc --noEmit` -- expected: no type errors
- `cd apps/webview-ui && pnpm lint` -- expected: no Biome errors
- `cd packages/client && pnpm test` -- expected: all 133+ tests pass (client package unchanged)
