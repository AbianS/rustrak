---
"@rustrak/server": patch
"@rustrak/client": patch
"webview-ui": patch
"docs": patch
"@rustrak/benchmarks": patch
---

Upgrade all dependencies to latest versions across the monorepo.

- TypeScript 6.0.3 + Node.js engines >=22 across all packages
- ky 2.x migration: `prefix` (was `prefixUrl`), updated hook signatures, removed 429 from retry list to avoid `Retry-After` sleep
- lucide-react 1.x: replaced removed `Github` brand icon with inline SVG component
- Rust: actix-web 4.13, actix-session 0.11, tokio 1.52, sqlx 0.8.6, rand 0.10 (`RngExt`), sha2 0.11 (`hex::encode`), hmac 0.13 (`KeyInit`)
