---
"@rustrak/server": patch
---

Hardens the whole write path so nothing acknowledged is lost. Direct transaction, span, log and session items now commit before the ingest endpoint returns, replayed items are deduplicated by protocol identity, and SQLite keeps event files queued until a full WAL checkpoint covers the digest. Alert delivery leases rows atomically and dispatches off the digest path, so an unreachable webhook no longer stalls ingestion and no alert is sent twice. Source map assembly tracks chunk ownership and stops stranding jobs on shared or terminally failed chunks. A malformed item is now dropped with a 200 instead of failing its whole envelope, matching Relay. `GET /health/version` requires authentication: unauthenticated monitoring of that endpoint now gets a 401, while `/health` and `/health/ready` stay open. The dashboard adds Romanian, French and Spanish. Most of the durability work is by @reneleonhardt, the new locales by @edideaur.
