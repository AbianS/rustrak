---
"@rustrak/server": patch
"docs": patch
---

Fix events.digest_order collision after retention purge that could silently drop events. Retention cleanup decremented the digested_event_count counter used to derive new digest_order values, letting it collide with a surviving event's row. Removed events.digest_order entirely — events now paginate within an issue on a (timestamp, id) keyset, matching Sentry's own per-group event ordering.
