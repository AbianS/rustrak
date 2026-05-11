---
name: protocol-context
description: Sentry wire protocol domain knowledge for sentry-protocol-drift changelog analysis and gap detection.
---

# Sentry Protocol Context

## Ingestion Endpoints

| Endpoint | Status | Notes |
|---|---|---|
| `POST /api/{project_id}/envelope/` | Required | Primary ingestion since Sentry v20.6.0 |
| `POST /api/{project_id}/store/` | Required | Deprecated by Sentry but still sent by older SDKs |

All other endpoints (`/minidump/`, `/unreal/`, `/security/`, OTLP paths) are optional — standard Sentry SDKs do not send to them.

## Authentication

- Header: `X-Sentry-Auth: Sentry sentry_version=7, sentry_key=<key>, sentry_client=<name/version>`
- Query string: `?sentry_version=7&sentry_key=<key>&sentry_client=<name/version>`
- DSN: `{protocol}://{public_key}:{optional_secret}@{host}{path}/{project_id}` (secret portion deprecated and can be empty)
- `sentry_version=7` is a fixed constant — unchanged since 2013

## HTTP Status Code Contract

| Situation | Required Code | Notes |
|---|---|---|
| Success | 200 | 202 also acceptable for non-OTLP endpoints |
| Oversized envelope | **413** | Changed from 400 in Relay 26.1.0 (Jan 2026) — SDKs use this to trigger backoff |
| Rate limited | 429 | Must include `Retry-After` header |
| Malformed envelope | 400 | |

## Envelope Item Types

**Must handle** (sent by all modern SDKs):
- `event` — error/exception events
- `transaction` — performance transactions
- `attachment` — file attachments
- `session` — release health sessions
- `client_report` — SDK-side discarded event counts

**Important to handle** (sent by SDKs ≥7.x/8.x, reaching most production deployments):
- `span` — standalone spans; graduated to GA in Relay 26.4.0 (April 2026); JS SDK 10.x sends these
- `check_in` — Cron Monitor check-ins
- `replay_event` + `replay_recording` — Session Replay; these two item types always arrive together in the same envelope
- `logs` — structured logs (GA 2025); emitted by `Sentry.logger.*` calls
- `profile` + `profile_chunk` — Continuous profiling

**Safely ignore** (cloud-specific or removed):
- `metricdata` — custom metrics; Sentry-cloud pipeline only
- `user_report` — deprecated by Sentry
- `otel_span` — removed in Relay 25.9.0 (alpha only)
- `otel_log` — removed in Relay 25.10.0 (alpha only)

## Forward Compatibility Rule

The envelope format is designed for forward compatibility: servers **must** silently accept and discard unknown item types and unknown item header fields. Never return a 4xx for an unrecognized item type — drop it and process the rest of the envelope.

## Changelog Keyword Signals

When scanning Relay release bodies, prioritize these signals:

**High priority** (likely breaking or impactful):
- "breaking", "removes", "removed", "deprecates", "deprecated"
- "status code", "HTTP status", "response code"
- "endpoint", "route", "authentication", "auth header", "X-Sentry-Auth"
- "required field", "schema"

**Medium priority** (new capability to evaluate):
- "adds item type", "new item type", "envelope item"
- "new field", "optional field"
- "SDK support", "client support"

**Ignore** (internal or cloud-specific):
- "performance improvement", "internal refactor", "relay processing"
- "feature flag", "cloud", "OTLP", "AI monitoring", "profiling pipeline"
- "sentry.io", "self-hosted" (when paired with "only" — means Sentry-cloud-only feature)

## Key Reference URLs

- Envelope spec: `https://develop.sentry.dev/sdk/data-model/envelopes/`
- Item types: `https://develop.sentry.dev/sdk/data-model/envelope-items/`
- Authentication: `https://develop.sentry.dev/sdk/foundations/transport/authentication/`
- Event payload: `https://develop.sentry.dev/sdk/data-model/event-payloads/`
- Relay CHANGELOG: `https://github.com/getsentry/relay/blob/master/CHANGELOG.md`
- Breaking changes policy: `https://develop.sentry.dev/sdk/getting-started/playbooks/sdk-lifecycle/breaking-changes/`
