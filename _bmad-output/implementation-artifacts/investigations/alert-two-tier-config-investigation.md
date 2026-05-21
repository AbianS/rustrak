# Investigation: Alert Two-Tier Config Architecture

## Hand-off Brief

1. **What happened.** Rustrak's current `notification_channels` table collapses credentials and routing into a single JSONB `config` column, forcing users to duplicate bot tokens / SMTP servers when they want different channels per project. Sentry solved this same problem with a clean two-tier split: org-level `integrations` (credentials only) + per-rule routing overrides.
2. **Where the case stands.** Root design confirmed via competitor analysis + codebase review. No open hypotheses remain.
3. **What's needed next.** Proceed to `bmad-quick-dev` to spec the redesign: introduce `integrations` (global credentials) + migrate `alert_rule_channels` to carry per-rule routing overrides.

## Case Info

| Field            | Value                                                                      |
| ---------------- | -------------------------------------------------------------------------- |
| Ticket           | N/A                                                                        |
| Date opened      | 2026-05-21                                                                 |
| Status           | Concluded                                                                  |
| System           | Rustrak monorepo — apps/server (Rust/actix-web/PostgreSQL)                 |
| Evidence sources | Codebase (migrations, models, routes, services), Sentry docs, Rollbar docs, GlitchTip source, web research |

## Problem Statement

When configuring alerts globally, it should be simple: connect Slack, Email, or a Webhook (just credentials). Then at the project level, each project should be able to customize routing — which Slack channel, which email recipients, which webhook URL. Currently the system forces full duplication of credentials per-project.

## Evidence Inventory

| Source                                                 | Status    | Notes                                                                   |
| ------------------------------------------------------ | --------- | ----------------------------------------------------------------------- |
| `apps/server/src/models/alert.rs`                      | Available | `SlackConfig`, `EmailConfig`, `WebhookConfig` — credentials + routing merged |
| `apps/server/migrations/postgres/20260121000000_create_alerting.up.sql` | Available | `notification_channels` table — `config` JSONB carries everything |
| `apps/server/src/routes/alerts.rs`                     | Available | CRUD for channels (global) + rules (per-project)                        |
| `apps/webview-ui/.../settings/alerts/`                 | Available | UI couples credentials + routing in one form                            |
| Sentry docs (integrations, slack)                      | Available | Clear two-tier pattern documented                                       |
| Rollbar docs                                           | Available | Flat per-project (no global credentials)                                |
| GlitchTip source (GitLab — rendered JS, not readable)  | Partial   | Known to use flat per-project webhook URL per recipient                 |

## Confirmed Findings

### Finding 1: Current design merges credentials + routing in one record

**Evidence:** `apps/server/src/models/alert.rs` — `SlackBotTokenConfig { token, channel, username, icon_emoji }` — the `token` is a credential; `channel` is routing. Both live in the same `notification_channels.config` JSONB column.

**Detail:** To send Slack alerts to 3 different channels across 3 projects, users must create 3 channel records — each with the same `xoxb-…` bot token. The token is duplicated in the DB (and in the UI form).

### Finding 2: Email has the same problem

**Evidence:** `apps/server/src/models/alert.rs` — `EmailConfig { recipients, smtp_host, smtp_port, smtp_username, smtp_password, from_address }` — SMTP credentials and recipient list are stored together.

**Detail:** A user with 5 projects all using the same SMTP server must configure SMTP credentials 5 times.

### Finding 3: Webhooks differ — the URL is often project-specific

**Evidence:** Industry pattern + user confirmation (conversation). Webhook URLs are typically unique per consumer endpoint (each project/service exposes its own ingest URL).

**Detail:** For webhooks, the "global" concept is weaker. A reasonable compromise: the integration stores a default URL + secret + headers; per-rule overrides can replace the URL and add extra headers.

### Finding 4: Sentry's proven pattern — `OrganizationIntegration` + per-rule action routing

**Evidence:** Sentry docs (organization/integrations/slack) — "Sentry's Slack integration is global to your Sentry organization and only needs to be set up once. After that, you can send notifications to different Slack channels per alert rule."

**Detail:**
- Tier 1 — **Integration** (org-level): OAuth token, workspace ID. Configured once by admin. Multiple workspaces supported.
- Tier 2 — **Alert rule action** (per-rule): which workspace + which channel. Stored in the alert rule, not the integration.
- Legacy integrations (per-project, fixed channel) coexisted with global during migration — explicit deprecation + disable path.

### Finding 5: GlitchTip and Rollbar use flat per-project (no global credentials)

**Evidence:** Rollbar docs — "Notifications are a project-level configuration." GlitchTip — per-project alert recipients with webhook URL directly attached.

**Detail:** Both simpler tools chose the flat model. This causes the same duplication problem Abian described. Neither has solved the two-tier problem — Rustrak can leapfrog here.

## Deduced Conclusions

### Deduction 1: The right target architecture for Rustrak

**Based on:** Findings 1–4

**Reasoning:** Sentry's two-tier model cleanly solves the problem. Rustrak's JSONB `config` column makes the split straightforward — no column type changes needed, just a schema reorganization.

**Conclusion:**

```
integrations (new table — global, org-scoped)
  id UUID PK
  name TEXT
  provider_type  ENUM(slack, email, webhook)
  credentials    JSONB   -- provider-specific, see below
  is_enabled     BOOL
  failure_count  INT
  last_failure_at  TIMESTAMPTZ
  last_success_at  TIMESTAMPTZ
  created_at / updated_at

-- credentials per provider:
-- Slack webhook:   { method: "webhook", webhook_url: "..." }
-- Slack bot_token: { method: "bot_token", token: "xoxb-..." }
-- Email:           { smtp_host, smtp_port, smtp_username, smtp_password, from_address }
-- Webhook:         { url, secret, headers: {...} }

alert_rule_channels (modified junction — adds routing_override column)
  alert_rule_id  UUID FK
  integration_id UUID FK  ← renamed from channel_id
  routing_override JSONB NULLABLE   -- per-rule overrides only

-- routing_override per provider:
-- Slack bot_token: { channel: "#my-project-channel" }
-- Slack webhook:   null (channel is baked into webhook URL — no override)
-- Email:           { recipients: ["team@example.com"] }
-- Webhook:         { url: "https://...", extra_headers: {...} }  (optional overrides)
```

### Deduction 2: Migration is safe and non-destructive

**Based on:** Finding 1, Finding 2, Sentry migration pattern (Finding 4)

**Reasoning:** Existing `notification_channels` records can be split algorithmically: extract routing fields → store as `routing_override` in the junction row; keep credentials in the new `integrations` table. No data is lost.

**Conclusion:** Migration SQL:
1. Create `integrations` table.
2. `INSERT INTO integrations SELECT id, name, channel_type AS provider_type, config-routing_fields AS credentials ...` — strip out routing fields from config JSONB.
3. Add `integration_id` FK column to `alert_rule_channels` (initially = old `channel_id`).
4. Populate `routing_override` by extracting routing fields from old `notification_channels.config`.
5. Rename `notification_channels` → `integrations` (or keep both during transition).
6. Drop old junction `channel_id` FK after backfill verified.

### Deduction 3: UI must show two separate sections

**Based on:** Deductions 1–2, user intent

**Reasoning:** Users configure integrations once in Settings → Integrations (global). Then when creating/editing an alert rule, they pick an integration and optionally override routing.

**Conclusion:**
- `/settings/integrations` — global provider setup (credentials only)
- Alert rule dialog — integration picker + routing override fields (channel, recipients, URL)
- The current `/settings/alerts` becomes the alert rules page, not the integration config page

## Hypothesized Paths

### Hypothesis 1: Webhook always needs per-rule URL (no meaningful global URL)

**Status:** Open

**Theory:** Webhook consumers typically expose unique URLs per service. A "global default URL" for webhooks has little practical use.

**Supporting indicators:** User confirmed "URL might change per project." Most webhook integrations in the wild are project-specific.

**Would confirm:** User says webhooks should never have a global URL default.

**Would refute:** User has a use-case for shared webhook endpoint with per-project routing via headers/payload.

**Resolution:** Pending user decision. Current recommendation: allow global default URL (optional) + per-rule URL override. If global URL is empty, per-rule URL is required.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | ------ | ------------- |
| Whether `alert_history` table needs `integration_id` FK (not just `channel_id`) | Audit log accuracy after migration | Review `alert.rs` service layer — check what it stores in history |
| Token redaction strategy for new `integrations` table GET responses | Security | Carried forward from existing `redact_slack_bot_token()` pattern |
| Whether client package types need full redesign or incremental update | Scope of packages/client work | Review `packages/client/src/types/alert.ts` |

## Source Code Trace

| Element       | Detail                                                                               |
| ------------- | ------------------------------------------------------------------------------------ |
| Credential+routing merge | `apps/server/src/models/alert.rs:SlackBotTokenConfig` — lines ~80-100 |
| DB schema | `apps/server/migrations/postgres/20260121000000_create_alerting.up.sql` |
| Routes | `apps/server/src/routes/alerts.rs` — `/api/alert-channels` (global) |
| Service trigger | `apps/server/src/services/alert.rs` — `trigger_new_issue_alert()` |
| Frontend global form | `apps/webview-ui/src/app/(main)/settings/alerts/alert-channels-list.tsx` |
| Frontend per-project | `apps/webview-ui/src/app/(main)/projects/[id]/project-alerts-dialog.tsx` |
| Client types | `packages/client/src/types/alert.ts` + `packages/client/src/schemas/alert.ts` |

## Conclusion

**Confidence:** High

The root design problem is confirmed: `notification_channels` collapses provider credentials and per-project routing into a single record, causing credential duplication. The fix is a clean two-tier split modeled after Sentry's global integrations architecture:

- **Tier 1 — Integrations** (global): credentials only. Create once, reuse across all projects.
- **Tier 2 — Alert rule routing** (per-rule): channel/recipients/URL overrides. Set per alert rule.

One open hypothesis: whether webhooks need a global URL at all. Current recommendation: optional global URL + required per-rule URL if global is absent.

GlitchTip and Rollbar both use the flat per-project model — they have the same duplication problem. Rustrak can leapfrog both with this design.

## Recommended Next Steps

### Fix direction

1. **New `integrations` table** — rename + restructure `notification_channels`: strip routing fields from credentials JSONB, add `provider_type` enum.
2. **Modify `alert_rule_channels` junction** — add `integration_id` FK + `routing_override JSONB` column.
3. **Migration script** — deterministic split of existing channel records into integrations + routing overrides.
4. **Update service layer** — `AlertService` reads integration credentials + merges routing_override at dispatch time.
5. **Update routes** — `/api/integrations` (global CRUD) + alert rule endpoints accept `routing_override` per channel.
6. **Update client package** — new types: `Integration`, `RoutingOverride` per provider.
7. **Update frontend** — `/settings/integrations` page (new) + alert rule dialog routing override fields.

### Diagnostic

- Confirm `alert_history` FK strategy (use `integration_id` or keep `channel_id` for historical records).
- Confirm webhook hypothesis with user before spec-writing.

## Reproduction Plan

N/A — design investigation, not a bug.

## Side Findings

- `spec-slack-multi-config.md` shows as `in-review` in the artifacts index, but user confirmed it is already merged. **Stale status** — should be updated to `done`.
- `alert_history` table references `channel_id` — this FK will need migration to `integration_id` or a soft rename.
- Existing `notification_channels` table has `failure_count` / `last_failure_at` fields that belong on the `integrations` table (they track provider health, not routing health).
