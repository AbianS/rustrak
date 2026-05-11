# Sentry Protocol Drift Report — 2026-05-11

## Summary

- **Relay versions reviewed:** 26.4.0 → 26.4.2 (last 3 releases, first run)
- **Protocol changes found:** 3 (0 high / 1 medium / 2 low)
- **Rustrak gaps:** 5 (0 high / 2 medium / 3 low)
- **SDK versions in the wild:** @sentry/node 10.52.0 · sentry-sdk (Python) 2.59.0

Rustrak's core protocol compliance is solid: 413, 429 + Retry-After, 400, and forward-compatible unknown item handling are all correct. Gaps are product-level (item types beyond `event` are silently discarded) and one low-risk status-code edge case for chunked multipart.

---

## Protocol Changes

### 26.4.2 — 2026-05-05

- Return 413 when **chunked multipart** requests exceed size limits. (#5880) — **LOW**
  Previously Relay returned a wrong code for oversized chunked multipart bodies. Rustrak's actix-web body reader handles chunked transfer encoding transparently, but the size limits live in the decompression/parser layer, not in an early middleware — see analysis in Gap 1 below.

### 26.4.1 — 2026-04-22

- Docker images moved from Docker Hub to GitHub Container Registry (ghcr.io). — **NO PROTOCOL IMPACT** (deployment-only breaking change)
- Return 429 for rate-limited OTLP log requests. (#5841) — **NO ACTION** (OTLP path, cloud-specific)

### 26.4.0 — 2026-04-15

- Graduate standalone `span` ingestion from feature flag to **GA**. (#5786) — **MEDIUM**
  @sentry/node ≥ 8.x and now the GA 10.52.0 send `span`-only envelopes for every traced operation. These contain no `event` item. Rustrak returns `200` with a generated UUID, which is protocol-compliant, but all span data is silently discarded (no storage, no tracing UI). See Gap 5.

---

## SDK Versions

| SDK | Version | Notes |
|---|---|---|
| @sentry/node | **10.52.0** | OTel-based; sends `span` items for every traced operation |
| sentry-sdk (Python) | **2.59.0** | Sends `session`, `transaction`, `client_report` by default |

---

## Rustrak Gaps

### Gap 1 — Chunked Multipart 413 Coverage — LOW

**Change:** Relay 26.4.2 fixed 413 responses for oversized chunked multipart bodies (#5880).

**Gap:** Rustrak's 413 path (`AppError::PayloadTooLarge` → `StatusCode::PAYLOAD_TOO_LARGE`) triggers from the parser layer (`apps/server/src/ingest/parser.rs:8`, `apps/server/src/ingest/decompression.rs:8`). If actix-web buffers the entire chunked body before the handler runs, the limits apply correctly. If a future refactor streams the body, the early chunked check must be added explicitly.

**Files:** `apps/server/src/ingest/decompression.rs`, `apps/server/src/ingest/parser.rs`

**Fix:** Add an actix-web `web::PayloadConfig::error_handler` that returns 413 at the framework layer before body bytes enter the handler. This is defensive against a streaming-body refactor and matches Relay 26.4.2 behavior:
```rust
// In main.rs / App builder
.app_data(web::PayloadConfig::default()
    .limit(100 * 1024 * 1024)  // 100 MiB
    .error_handler(|err, _req| {
        actix_web::error::InternalError::from_response(
            err,
            HttpResponse::PayloadTooLarge().finish(),
        ).into()
    })
)
```

---

### Gap 2 — `session` Items Silently Discarded — MEDIUM

**Change:** `session` items are in the "must handle" tier of the Sentry envelope spec and are sent by every modern SDK (Python sentry-sdk 2.59.0, @sentry/node 10.52.0). These carry release health data (crashed, errored, exited session counts).

**Gap:** `apps/server/src/routes/ingest.rs:77` filters exclusively for `item.headers.item_type == "event"`. Session items pass through the parser, are never extracted, and are never stored. Release health is entirely absent.

**Files:** `apps/server/src/routes/ingest.rs:74-86`

**Fix:** Add a session item processor alongside the event processor. At minimum, parse the session JSON payload and insert a row into a `sessions` table. The session payload schema is documented at `https://develop.sentry.dev/sdk/data-model/event-payloads/session/`.

---

### Gap 3 — `transaction` Items Silently Discarded — MEDIUM

**Change:** `transaction` items are in the "must handle" tier. Every traced Python/Node request generates a transaction envelope. With @sentry/node 10.52.0 plus the graduated `span` pipeline, high-volume apps send both `transaction` and `span` envelopes continuously.

**Gap:** Same filter as Gap 2 — only `event` items are extracted. Transaction payloads (performance traces) are never stored.

**Files:** `apps/server/src/routes/ingest.rs:74-86`

**Fix:** Extend the item loop to also extract `transaction` items and store them (or at minimum log their receipt). Transaction payload shape is identical to an error event but with `type: "transaction"` in the item header and `"type": "transaction"` in the JSON body.

---

### Gap 4 — `client_report` Items Not Tracked — LOW

**Change:** `client_report` items report SDK-side discards (rate-limited events, dropped items). Sentry uses these to show "discarded events" metrics in the dashboard. The spec classifies them as "must handle."

**Gap:** Client reports are silently dropped. No visibility into how much data SDKs are discarding before reaching Rustrak.

**Files:** `apps/server/src/routes/ingest.rs:74-86`

**Fix:** Parse `client_report` JSON payloads and store discard counts per `reason` + `category`. This is a lightweight insert (no event processing) and provides operational insight.

---

### Gap 5 — `attachment` Items Not Stored — LOW

**Change:** `attachment` items are in the "must handle" tier. SDKs send binary file attachments alongside error events.

**Gap:** Attachment payloads are parsed (the envelope parser reads and discards the byte payload) but never stored. Users see no attachments in the dashboard even when SDKs send them.

**Files:** `apps/server/src/routes/ingest.rs:74-86`

**Fix:** Extract attachment items from the same envelope loop. Store attachment metadata (filename, content_type, size) and payload bytes to object storage or disk alongside the parent event. The parent event_id is available from the envelope header.

---

## No Action Required

| Change | Reason |
|---|---|
| Relay 26.4.1: Docker Hub → GHCR | Deployment infrastructure only; no wire protocol change |
| Relay 26.4.1: 429 for OTLP rate limits | OTLP path only; Rustrak does not ingest OTLP |
| Relay 26.4.0: Non-public email PII scrubbing change | PII normalization in Relay pipeline; Rustrak passes raw SDK payloads through |
| Relay 26.4.0: Remove transaction metrics extraction | Internal Relay EAP pipeline only |
| `span` items silently discarded | Forward compatibility rule: servers MUST silently discard unknown/unhandled item types; returning 200 is correct |
| `replay_event` / `replay_recording` silently discarded | Same — correct forward compat behavior |
| `logs` silently discarded | Same — correct forward compat behavior |
| `profile` / `profile_chunk` silently discarded | Same — correct forward compat behavior |
