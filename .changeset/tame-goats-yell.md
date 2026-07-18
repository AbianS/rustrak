---
"@rustrak/server": "patch"
"docs": "patch"
---

Fixed a production migration failure on startup. `20260718000000_agent_perf_indexes` combined two `CREATE INDEX CONCURRENTLY` statements in a single migration file; sending multiple statements together makes Postgres wrap them in an implicit transaction, and `CONCURRENTLY` cannot run inside any transaction block, so the server failed to boot with "CREATE INDEX CONCURRENTLY cannot run inside a transaction block". The migration is now split into two single-statement migrations, one per index, so both can run outside a transaction as intended.
