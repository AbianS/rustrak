# Bond

## Basics
- **Name:** Abian
- **Call them:** Abian
- **Language:** Spanish

## Rustrak Implementation State
_What the owner has told me about Rustrak's current Sentry compatibility._

### Implemented
- Envelope parsing (newline-delimited format, item headers + payloads)
- `event` item type handling (only type currently processed)
- Decompression: gzip, deflate, brotli
- Auth: `X-Sentry-Auth` header + `?sentry_key=` query param (project sentry_key UUID validation)
- Rate limiting: 429 + `Retry-After` header (global + per-project, minute + hour windows)
- Envelope response: `{"id": "<uuid>"}` on success (200)
- Payload size limits: 1MB per item, 100MB max compressed body
- Async digest: grouping, issue creation, advisory locks per project

### In Progress
- feat/sentry-agent branch (current)

### Known Missing
- `X-Sentry-Rate-Limits` header on 429 responses
- `/store/` endpoint functional implementation (currently returns 400)
- `event_id` auto-generation when absent from envelope headers (currently rejects with 400)
- Session items (`session`, `sessions` types) — silently ignored
- Transaction/performance items — silently ignored
- Attachment items — silently ignored

## Local Repo State
- **relay-repo SHA:** 4222d43e090dc7215411ad2dbacd6cc8efb12ba7
- **relay-repo last updated:** 2026-05-22
- **sentry-data-schemas SHA:** 6d2c435b8ce3a67e2065f38374bb437f274d0a6c
- **sentry-data-schemas last updated:** 2026-05-22

## Known Protocol Gaps Already Investigated
_Gaps we've already dug into — so I don't repeat the same work. Append after each [AU] session._

| Gap | Status | Session | Notes |
|-----|--------|---------|-------|
| `X-Sentry-Rate-Limits` header | ❌ Missing | 2026-05-22 | Relay returns `retry_after:categories:scope:reason_code:namespaces`. Rustrak only returns `Retry-After`. Fix: add header with format `"<secs>:error:project"` minimum. Relay permalink: relay-server/src/utils/rate_limits.rs#L18 |
| `/store/` endpoint | ❌ Missing | 2026-05-22 | Relay accepts POST JSON body, wraps in envelope, returns `{"id":"..."}`. Rustrak returns 400. Affects legacy SDK users. Relay permalink: relay-server/src/endpoints/store.rs#L105 |
| `event_id` auto-generation | ⚠️ Different | 2026-05-22 | Relay: if event_id absent + envelope has event item, auto-generates UUID. Rustrak: returns 400. Relay permalink: relay-server/src/envelope/mod.rs#L290 |
| 429 response body format | ⚠️ Different | 2026-05-22 | Relay returns `{}` (empty). Rustrak returns `{"error":"rate_limit_exceeded","retry_after":N}`. Low impact — SDKs don't parse 429 body. |

## How They Work
{Preferences learned during First Breath and refined over sessions — how deep to go, raw source vs synthesis, what to emphasize.}

## Things They've Asked Me to Remember
{Explicit requests — protocol decisions, design choices, things to keep in mind across sessions.}

## Things to Avoid
{What doesn't work for them — e.g. "don't explain what an envelope is every session", "skip the basics".}
