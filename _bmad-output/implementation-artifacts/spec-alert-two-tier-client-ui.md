---
title: 'Alert Two-Tier — Client Package & Frontend UI'
type: 'feature'
created: '2026-05-21'
status: 'in-progress'
baseline_commit: '1d6d45773f1891aab4198e70f2ae41b814cfd6f4'
context:
  - '_bmad-output/implementation-artifacts/spec-alert-two-tier-integrations.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `packages/client` and `apps/webview-ui` still reference the old `notification_channels` model (`channel_type`, `config`, `channel_ids`, `/api/alert-channels`) and mix routing concerns (Slack channel, email recipients) into the credentials forms — after the backend two-tier migration (PR #85), client and UI are out of sync with the new API.

**Approach:** Update `packages/client` to match the new API (rename resource, schemas, types, endpoints); update `apps/webview-ui` to use credentials-only integration forms in settings and per-integration `routing_override` fields in the alert rule dialog.

## Boundaries & Constraints

**Always:**
- Client types must be inferred with `z.infer` from Zod schemas — never define TypeScript types manually.
- MSW handlers in `tests/mocks/handlers.ts` must be updated alongside resource changes — do not leave stale `/api/alert-channels` handlers.
- Credentials forms in settings must only capture credential fields — routing fields (channel, recipients, override URL) belong only in the rule dialog.
- Slack bot_token test button must accept a `channel` before dispatching (API `validate_routing_override` rejects empty channel).
- Keep legacy `channel_ids` field as optional on `createAlertRuleSchema` / `updateAlertRuleSchema` for backward compat.

**Ask First:**
- If `extra_headers` UI for Webhook routing_override should be included (currently flagged as D-15 security concern).

**Never:**
- Add pagination to the integrations settings list.
- Expose SMTP password or webhook secret in any test or routing form field.
- Add `NEXT_PUBLIC_` prefix to any env var.
- Alias the old `alertChannels` property on `RustrakClient` — remove it outright; frontend is the only consumer.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create Slack bot_token integration | Settings form: name, method=bot_token, xoxb- token | POST `/api/integrations` — credentials without channel; response shows `"xoxb-****"` | Form error if token missing `xoxb-` prefix |
| Edit Slack bot_token integration | User changes name only, leaves token blank | PATCH sends `credentials` without token field (keep existing) | Form error if user fills token incorrectly |
| Create alert rule — Slack bot_token routing | Integration selected, `#fe` entered in channel field | `channels:[{integration_id, routing_override:{channel:"#fe"}}]` sent | Form validation error if channel blank |
| Create alert rule — Email routing | Integration selected, recipients `a@b.com, c@d.com` | `routing_override:{recipients:["a@b.com","c@d.com"]}` sent | Form error if any address lacks `@` or list is empty |
| Create alert rule — Webhook routing | Credentials has no URL, `https://svc.io/hook` entered | `routing_override:{url:"https://svc.io/hook"}` sent | Form error if URL not http/https |
| Test Slack bot_token integration | Test button clicked | Inline channel input appears → POST with `routing_override:{channel}` | Show error message from API on failure |

</frozen-after-approval>

## Code Map

- `packages/client/src/schemas/alert.ts` — Zod schemas (single source of truth for all alert models)
- `packages/client/src/types/alert.ts` — TypeScript types (all `z.infer`)
- `packages/client/src/resources/alert-channels.ts` → `alert-integrations.ts` — HTTP resource class
- `packages/client/src/resources/index.ts` — resource barrel exports
- `packages/client/src/client.ts` — `RustrakClient` assembly
- `packages/client/tests/mocks/handlers.ts` — MSW mock API handlers
- `packages/client/tests/integration/alert-channels.test.ts` → `alert-integrations.test.ts`
- `packages/client/tests/integration/alert-rules.test.ts` — rule tests (channel_ids → integration_ids)
- `apps/webview-ui/src/actions/alerts.ts` — Next.js Server Actions
- `apps/webview-ui/src/app/(main)/settings/settings-nav.tsx` — settings sidebar nav
- `apps/webview-ui/src/app/(main)/settings/alerts/` → `settings/integrations/` — integrations settings page
- `apps/webview-ui/src/app/(main)/projects/[id]/project-alerts-dialog.tsx` — rule create/edit dialog

## Tasks & Acceptance

**Execution:**

- [ ] `packages/client/src/schemas/alert.ts` — on `notificationChannelSchema`: rename `channel_type`→`provider_type`, `config`→`credentials`; on `createNotificationChannelSchema`/`updateNotificationChannelSchema`: same renames; on `alertRuleSchema`: rename `channel_ids`→`integration_ids`; on `alertHistorySchema`: rename `channel_id`→`integration_id`; add `alertRuleChannelInputSchema = z.object({ integration_id: z.number().int(), routing_override: z.record(z.string(), z.unknown()).default({}) })`; add `channels: z.array(alertRuleChannelInputSchema).default([])` to `createAlertRuleSchema` and `updateAlertRuleSchema` (keep `channel_ids` as optional legacy); export new schema and `testIntegrationBodySchema = z.object({ routing_override: z.record(z.string(), z.unknown()).optional() })`
- [ ] `packages/client/src/types/alert.ts` — re-infer all types; add `AlertRuleChannelInput = z.infer<typeof alertRuleChannelInputSchema>`; add `RoutingOverride = Record<string, unknown>`; remove `NotificationChannel`/`ChannelType` if unused by export consumers (keep as alias if exported)
- [ ] `packages/client/src/resources/alert-channels.ts` → rename file to `alert-integrations.ts`; rename class to `AlertIntegrationsResource`; update all paths `/api/alert-channels`→`/api/integrations`; update `test(id: number, routingOverride?: RoutingOverride): Promise<TestChannelResponse>` to POST body `{ routing_override: routingOverride }` when provided
- [ ] `packages/client/src/resources/index.ts` — export `AlertIntegrationsResource` (remove `AlertChannelsResource`)
- [ ] `packages/client/src/client.ts` — rename property `alertChannels`→`alertIntegrations`, type `AlertIntegrationsResource`
- [ ] `packages/client/tests/mocks/handlers.ts` — replace all `/api/alert-channels` handlers with `/api/integrations`; update mock response payloads to use `provider_type`/`credentials`/`integration_ids`/`integration_id`
- [ ] `packages/client/tests/integration/alert-channels.test.ts` → rename file to `alert-integrations.test.ts`; update all `client.alertChannels`→`client.alertIntegrations`; update mock data field names; verify coverage ≥ 97%
- [ ] `packages/client/tests/integration/alert-rules.test.ts` — update mock data `channel_ids`→`integration_ids`; add tests for `channels` field with `routing_override`
- [ ] `apps/webview-ui/src/actions/alerts.ts` — rename all `*NotificationChannel*` functions to `*Integration*`; switch `client.alertChannels`→`client.alertIntegrations`; add `testIntegration(id: number, routingOverride?: RoutingOverride)` forwarding optional body; keep old function names as deprecated aliases if other files import them (grep first)
- [ ] `apps/webview-ui/src/app/(main)/settings/settings-nav.tsx` — change href `/settings/alerts`→`/settings/integrations`, label `"Global Alerts"`→`"Integrations"`
- [ ] `apps/webview-ui/src/app/(main)/settings/alerts/` → rename directory to `integrations/`; rename `alert-channels-list.tsx`→`integrations-list.tsx`; update `page.tsx` to call `listIntegrations()` and render `<IntegrationsList>`; in SlackConfigDialog remove `channel`, `username`, `icon_emoji` from form fields and Zod schema; in EmailConfigDialog remove `recipients`; in WebhookConfigDialog make `url` optional; for Slack bot_token test: replace plain test button with a small inline form showing a "Channel" text input (required) → call `testIntegration(id, { channel })` on submit
- [ ] `apps/webview-ui/src/app/(main)/projects/[id]/project-alerts-dialog.tsx` — replace `channel_ids: number[]` checkbox approach with `channels: AlertRuleChannelInput[]` array builder; for each selected integration show routing_override fields based on `provider_type`: Slack bot_token → required `#channel` text input; Slack webhook → none; Email → required `recipients` textarea (comma-separated, split+trim on submit, validate each has `@`); Webhook → optional `url` input (validate http/https when filled); pre-populate edit form from `rule.integration_ids` (not `channel_ids`); on submit serialize as `channels` array

**Acceptance Criteria:**
- Given `pnpm test --filter @rustrak/client`, all tests pass and coverage stays ≥ 97%.
- Given `pnpm build --filter @rustrak/client`, dual ESM+CJS output with zero TypeScript errors.
- Given `pnpm build --filter webview-ui`, zero TypeScript errors.
- Given `pnpm lint`, zero Biome errors including `useFilenamingConvention` (all new files kebab-case).
- Given the settings nav, clicking "Integrations" navigates to `/settings/integrations`.
- Given a Slack bot_token integration config dialog, no `channel` field is present.
- Given an alert rule form with Slack bot_token integration, submitting with blank channel shows a client-side validation error without calling the API.
- Given an alert rule form with Email integration, the API receives `channels:[{integration_id, routing_override:{recipients:[...]}}]`.

## Design Notes

**Routing override fields per provider (shown only in rule dialog):**

```text
slack/webhook   → no routing fields
slack/bot_token → required text input "Slack Channel" — placeholder "#alerts"
email           → required textarea "Recipients" — comma-separated, validated on @
webhook         → optional text input "Override URL" — validated http/https when filled
```

**Test button UX for Slack bot_token (settings page):**
Replace the single "Test" button with a small inline form: `[Channel input] [Test]`. Only shown when `provider_type === 'slack' && credentials.method === 'bot_token'`. For all other types, single "Test" button fires directly.

**Token blank-on-edit (Slack bot_token):**
When editing, if the user submits with `token` field blank, omit `token` from the PATCH `credentials` payload (keep existing server-side value). If `token` is filled, include it. This matches existing behavior in the current `SlackConfigDialog`.

## Verification

**Commands:**
- `cd packages/client && pnpm test` — expected: all tests pass, coverage ≥ 97%
- `cd packages/client && pnpm build` — expected: zero errors, ESM + CJS + DTS emitted
- `cd apps/webview-ui && pnpm build` — expected: zero TypeScript errors
- `pnpm lint` — expected: zero Biome errors
