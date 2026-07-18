---
"@rustrak/server": "patch"
"docs": "patch"
---

## Dashboard Query Performance

Fixed two independent causes of multi-second dashboard queries that saturated the database connection pool on installations with large `spans` and `transactions` tables.

Agent trace queries scanned the entire spans table. The `gen_ai_*` columns were added to tables already holding millions of rows, and since `ADD COLUMN` does not rewrite the heap, the new column had no planner statistics: Postgres assumed `IS NOT NULL` matched every row and fell back to a sequential scan, taking around 14 seconds even when no AI spans existed at all. Partial indexes now carry the predicate themselves, so the plan no longer depends on column statistics and the fix applies to existing installations without any manual `ANALYZE`.

Transaction stats streamed every matching row to the application to compute percentiles in memory, over a million values per request on busy projects. Postgres now computes them as ordered-set aggregates in a single round trip, cutting the endpoint from roughly 14 seconds to 300 milliseconds. SQLite keeps the in-memory path, since it has no `percentile_cont`.
