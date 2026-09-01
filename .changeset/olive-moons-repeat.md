---
"docs": patch
---

Document the 64-character minimum on `SESSION_SECRET_KEY`, why
`openssl rand -base64 32` is not a substitute, and that changing the key
invalidates existing sessions. The installation and production guides no longer
publish a working key as their example value.
