---
"@rustrak/server": "patch"
---

Agent traces gain a span detail panel and the agents dashboard gains numbers. A new `GET /api/projects/{id}/spans/{span_id}` returns a span with its full attribute bag (prompts, responses, tool arguments and results, system instructions, tool definitions), normalizing the two on-disk shapes of `spans.data` so callers see one flat shape. The trace page splits into a waterfall beside a details panel, with the selected span in the URL so it is server-rendered and shareable, opening on the first LLM call. Token accounting reconciles the two provider conventions for whether input includes cached tokens, and warns when the parts miss the reported total.

The dashboard adds `/agents/summary`, `/agents/models`, `/agents/tools/stats` and `/agents/environments`, surfaced as a totals row and per-model and per-tool tables, with window and environment filters held in the URL. Cached-input and reasoning-output token counts are now stored, read under both attribute spellings.

Fixes: platform, release and environment are stamped on transaction-embedded spans and on the promoted agent root, which previously read NULL and made an environment filter drop every agent run; the waterfall collapse control is no longer an interactive element nested inside another; v2 attributes whose declared type contradicts their value are dropped as Relay does; and three endpoints stopped publishing a `limit` parameter they ignore.
