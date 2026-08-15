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

The user-facing compose files pin `postgres:16-alpine` (each with an inline
"no further" comment) and mount `/var/lib/postgresql/data`:

- `docker-compose.yml`
- `docker-compose.dev.yml`
- `apps/docs/content/configuration/database.mdx` (documented example)
- `apps/docs/content/getting-started/installation.mdx` (documented example)

`packages/benchmarks/docker-compose.benchmark.yml` is the exception: it
defaults to 18 (the engine under evaluation, issue #202) and its default
mount follows 18's relocated data directory; `PG_VERSION=16` still selects 16.

A move to 18 needs each of these updated, and existing users cannot simply bump
the image tag — their data volume is mounted at the old path.

### Upgrading (pg_upgrade)

Run with both data directories mounted — old at the 16-era path, new at the
18-era path — preferring `--clone`: on a copy-on-write filesystem (btrfs, XFS
with reflink, ZFS, APFS) the data files are reflinked rather than copied, so
**even multi-GB databases upgrade in seconds**:

```bash
pg_upgrade --clone \
  --old-datadir=/var/lib/postgresql/16/data \
  --new-datadir=/var/lib/postgresql/18/data \
  --old-bindir=/usr/lib/postgresql/16/bin \
  --new-bindir=/usr/lib/postgresql/18/bin
```

Both clusters must live on the same filesystem for `--clone`/`--link` to work.
`--link` (hard links) is the fallback where reflinks are unsupported; plain
dump/restore always works but copies everything. After the upgrade, start the
18 server (volume now at `/var/lib/postgresql`) and drop the old cluster.

**This, not raw throughput, is what the issue should weigh.**

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
