# PostgreSQL 16 vs 18 — findings

Context: issue #202 (rustrak/rustrak) asks whether Rustrak should move to
PostgreSQL 18 for its performance improvements. This documents what the
benchmark work turned up. All benchmark harness changes are uncommitted.

## Findings that do not depend on the numbers

### 1. Rustrak runs on PostgreSQL 18 with no code changes

The full migration set applies cleanly on 18.4, `sqlx` 0.9 speaks the protocol,
and the server boots and ingests normally. There is no compatibility work in the
server itself.

### 2. PostgreSQL 18 has a breaking change in the official Docker image

This is the real cost of the upgrade, and it is an operations change, not a code
one. The `postgres:18` image relocated the data directory: the volume must be
mounted at `/var/lib/postgresql` (it creates a version-named subdirectory
inside), **not** at `/var/lib/postgresql/data`, which was correct through 17.
Mounting the old path makes an 18 container refuse to start.

Every compose file in this repo pins `postgres:16-alpine` and mounts
`/var/lib/postgresql/data`:

- `docker-compose.yml`
- `docker-compose.dev.yml`
- `README.md` (documented example)
- `apps/docs/content/configuration/production.mdx` (documented example)

A move to 18 needs each of these updated, and existing users cannot simply bump
the image tag — their data volume is mounted at the old path. An upgrade path
(pg_upgrade, or dump/restore) has to be documented. **This, not raw throughput,
is what the issue should weigh.**

### 3. The benchmark suite was measuring SQLite, not PostgreSQL

Pre-existing bug, unrelated to 18 but found along the way. The server
`Dockerfile` defaults to `ARG FEATURES=sqlite`, and the benchmark compose never
overrode it, so the "PostgreSQL benchmark" built a SQLite server that ignored
`DATABASE_URL`. Any earlier result in `results/` reflects SQLite. Fixed here by
pinning `FEATURES: postgres` and tagging the image `bench-postgres`.

## Methodology notes (read before trusting any number)

- **PostgreSQL is capped at 1 CPU** in the benchmark environment. That makes the
  database the bottleneck, which is good for sensitivity but *overstates* the
  size of any version difference relative to a real deployment with more cores.

- **Cache hit ratio sits at ~100%** in the default scenarios: the working set
  fits in shared_buffers, so the engine never reads from disk during the
  measured window. PostgreSQL 18's headline feature is asynchronous I/O
  (`io_method`), and a workload with no disk reads cannot show any benefit from
  it. To test that fairly, run the `read-cold` scenario with `shared_buffers`
  forced down so the working set exceeds the cache:

  ```bash
  VARIANTS="pg16-cold:16:-c shared_buffers=16MB pg18-cold:18:-c shared_buffers=16MB" \
    SCENARIOS="read-cold" ./scripts/run-matrix.sh
  ```

  Then confirm the reported cache hit ratio actually dropped; if it is still
  ~100%, the working set did not exceed the cache and the result says nothing.

- **The old scenarios could not answer this question at all.** They measured
  only the HTTP ingest path, which returns before the database work happens (the
  digest runs in a spawned task). The `drain` and `read` scenarios added here are
  what actually exercise PostgreSQL.

## Results

<!-- Fill in from `cargo run --release -- matrix` once a full matrix has run. -->
_Pending a complete matrix run. A partial PG16-only run is archived under
`results/archive/`._
