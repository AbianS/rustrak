---
"@rustrak/server": "patch"
---

Zero-copy ingest. The envelope body is parsed in place and item payloads are handed out as slices of the single request allocation instead of a copy per item, with a size-aware heuristic that detaches a small payload rather than pinning a large envelope behind it. Event validation walks the JSON without building a `serde_json::Value` tree, the digest drops the raw file contents once the tree is parsed, and the event list query selects its columns instead of loading and parsing the full `data` blob per row only to discard it. (@reneleonhardt)

Peak memory under bursts is bounded. Spawned digest tasks pass through a gate of 16, so a burst queues holding only its metadata instead of one full payload plus its parsed working set each. Envelopes are capped at 1024 items and log and span containers at 1024 entries. The HTTP request path never waits on the gate. (@reneleonhardt)

`zstd` is accepted as a Content-Encoding, and chained encodings are decoded in reverse application order. The header is validated for ASCII and malformed token lists, `identity` is a no-op, coding names are matched case-insensitively, gzip reads multi-member streams, deflate tries zlib-wrapped and then raw, and every codec enforces the 100MB decompressed ceiling while decoding rather than after. (@reneleonhardt)

Pending event records are written durably in a stream: base64 is encoded in 48KB chunks straight into a buffered writer, so storing an event no longer materialises a whole second copy of the payload as an encoded string. The temporary file is opened with `create_new`, a malformed record is quarantined by hard link before the atomic rename so a crash cannot leave recovery with neither the old record nor the new one, and the parent directory is synced after publishing. The ingest directory is created once at startup. (@reneleonhardt)
