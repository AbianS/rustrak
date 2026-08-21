---
"docs": patch
---

Document the SQLite durability trade-off: WAL with `synchronous=NORMAL` survives a crash of the Rustrak process but not an OS crash or a power loss, and PostgreSQL is the answer for deployments that cannot accept it.
