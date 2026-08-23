---
"@rustrak/server": minor
---

Thread `bytes::Bytes` through the ingest path so envelope payloads borrow slices from one shared buffer instead of making per-item copies. Validate event JSON without building a `Value` tree, cap concurrent spawned processing at 16 tasks, and release raw file bytes after digest parsing. Event list queries select summary fields instead of loading the full JSON payload, which the list response never returns. Request decompression is bounded and supports zstd. Durable publication remains crash-safe on the same filesystem.
