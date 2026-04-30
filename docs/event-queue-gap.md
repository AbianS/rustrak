# Event Queue Recovery Gap

## Current Architecture

```
HTTP POST → Parse → Write to disk (/tmp/rustrak/ingest/<uuid>.json) → tokio::spawn(process_event) → Return 200
                                                                              │
                                                                              └→ Read disk → Digest → Delete file
```

Events are staged on disk and processed via an async tokio task. There is no database-backed queue or durable job store.

## Disk Storage Format

Events are written to disk as raw JSON (`.json` files). This is wasteful in two ways:

1. **Space** — JSON is text with redundant whitespace and verbose field names. Sentry event payloads with stacktraces can be 10–50KB.
2. **Parse cost** — Each event must be deserialized from JSON twice: once on ingest (validation), once during digest (grouping + storage). Re-parsing adds latency.

### Alternatives

| Format | Write Size | Parse Speed | Human-Readable | Notes |
|--------|-----------|-------------|:---:|-------|
| **JSON (current)** | Baseline | Baseline | Yes | Readable, no extra deps |
| **MessagePack** | ~30–50% smaller | 2–3x faster | No | Binary, widely supported in Rust via `rmp-serde` |
| **CBOR** | ~30–50% smaller | 2–3x faster | No | Similar to MessagePack, IETF standard (RFC 7049) |
| **Zstd-compressed JSON** | ~70–80% smaller | Slower (compress + decompress) | No | Dramatic space savings, but adds CPU cost |
| **bincode** | ~40–50% smaller | Very fast | No | Rust-native, zero-copy deserialization possible, not cross-language |
| **Protobuf** | ~50–60% smaller | Very fast | No | Cross-language, schema required, overkill for temp files |

### Recommendation

**MessagePack** (`rmp-serde`) hits the sweet spot — it's a drop-in replacement for JSON via serde, cuts disk I/O by ~40%, and is already in the Sentry ecosystem (Sentry uses msgpack internally for the event store). Adding it would be a one-line change in `storage.rs`:

```rust
// Current
fs::write(&path, serde_json::to_vec(&event)?).await?;
// MessagePack
fs::write(&path, rmp_serde::to_vec(&event)?).await?;
```

## Gap

**On server restart or crash, orphaned event files on disk are never recovered or reprocessed.**

Specifically:
- `tokio::spawn` tasks are not persisted — they die with the process
- No startup scan reads `/tmp/rustrak/ingest/` for pending files
- No status tracking exists for whether a file was fully digested
- No retry mechanism if `process_event` fails after the tokio spawn

## Impact

- Events accepted (HTTP 200 returned) but not yet digested are silently lost on restart
- Common during deploys, OOM kills, or unexpected panics
- No observability into queue depth or stuck events

## Potential Fixes

1. **Startup recovery scan** — on boot, list `/tmp/rustrak/ingest/*.json` and spawn `process_event` for each. Simple but still has race windows during crash.
2. **Database-backed queue** — add an `ingest_queue` table with `status: pending|processing|completed|failed`. Insert row during ingest, update to `completed` after digest. Worker polls for `pending` rows on a loop. Survives restarts, enables retry, gives observability.
3. **External queue (Redis/NATS)** — overkill for Rustrak's scale. Only consider if throughput demands it.

## Note for LLM Analysis Queue

The planned LLM analysis feature (see `llm_analyses` table) should use approach #2 from the start — a `status` column (`pending → running → completed|failed`) with a background poller in the main process. LLM calls are long-running (10-30s+), making durability more important than for the ingest path.
