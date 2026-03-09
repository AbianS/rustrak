---
"@rustrak/server": minor
"docs": patch
---

SQLite is now the default database backend

BREAKING CHANGE: The `latest` Docker image now uses SQLite instead of PostgreSQL.

If you are using `abians7/rustrak-server:latest` with PostgreSQL, update your image tag:

```yaml
# Before
image: abians7/rustrak-server:latest

# After
image: abians7/rustrak-server:postgres
```

No data migration required — only the image tag changes.

New: SQLite support with zero configuration. No `DATABASE_URL` needed — data is stored automatically at `/data/rustrak.db` inside the container. Mount a volume at `/data` to persist data.

Docker Hub now publishes two variants per release:
- `latest` / `vX.Y.Z` → SQLite (default, no external database)
- `postgres` / `vX.Y.Z-postgres` → PostgreSQL

New "Database Backends" documentation page with SQLite vs PostgreSQL comparison, Docker Compose examples, and backup strategies.
