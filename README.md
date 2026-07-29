<div align="center">
  <img src="https://raw.githubusercontent.com/rustrak/rustrak/main/apps/docs/public/logo.svg" alt="Rustrak" width="80" height="80" />
  <h1>Rustrak</h1>
  <p><strong>Ultra-lightweight, self-hosted error tracking compatible with Sentry SDKs</strong></p>

  <p>
    <a href="https://github.com/rustrak/rustrak/actions/workflows/ci.yml">
      <img src="https://github.com/rustrak/rustrak/actions/workflows/ci.yml/badge.svg" alt="CI" />
    </a>
    <a href="https://github.com/rustrak/rustrak/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/license-GPL--3.0-blue.svg" alt="License" />
    </a>
    <a href="https://github.com/rustrak/rustrak/releases">
      <img src="https://img.shields.io/github/v/release/rustrak/rustrak" alt="Release" />
    </a>
  </p>

  <p>
    <a href="https://rustrak.github.io/rustrak">Documentation</a>
    ·
    <a href="https://github.com/rustrak/rustrak/issues">Report Bug</a>
    ·
    <a href="https://github.com/rustrak/rustrak/issues">Request Feature</a>
  </p>
</div>

---

## Why Rustrak?

Most error tracking solutions are either expensive SaaS products or heavy self-hosted applications. Rustrak is different:

- **Sentry Compatible** - Works with any existing Sentry SDK (Python, JavaScript, Go, Rust, etc.)
- **Lightweight** - Server runs with ~50MB memory footprint
- **Fast** - <50ms P99 ingestion latency, 10k+ events/second
- **Simple** - Single binary, no Redis or complex infrastructure
- **Flexible** - SQLite (zero setup) or PostgreSQL (production scale)

<img width="1280" height="412" alt="Frame 2" src="https://github.com/user-attachments/assets/208baa3c-9680-4bdf-bd81-901fa3a398c3" />


## Quick Start

### SQLite (default — no external database)

The default image uses SQLite. No PostgreSQL needed.

```yaml
services:
  server:
    image: rustrak/rustrak-server:latest
    ports:
      - "8080:8080"
    volumes:
      - rustrak_data:/data
    environment:
      - SESSION_SECRET_KEY=${SESSION_SECRET_KEY}
      - CREATE_SUPERUSER=${CREATE_SUPERUSER}
    restart: unless-stopped

  ui:
    image: rustrak/rustrak-ui:latest
    ports:
      - "3000:3000"
    environment:
      - RUSTRAK_API_URL=http://server:8080
    depends_on:
      - server
    restart: unless-stopped

volumes:
  rustrak_data:
```

```bash
SESSION_SECRET_KEY=$(openssl rand -hex 32)
CREATE_SUPERUSER=admin@example.com:changeme123
docker compose up -d
```

Open http://localhost:3000 and login with your `CREATE_SUPERUSER` credentials.

### PostgreSQL (production)

Use the `:postgres` image tag when you need PostgreSQL.

#### 1. Create `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  server:
    image: rustrak/rustrak-server:postgres
    ports:
      - "${SERVER_PORT}:8080"
    environment:
      - PORT=8080
      - RUST_LOG=${RUST_LOG}
      - DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      - SESSION_SECRET_KEY=${SESSION_SECRET_KEY}
      - CREATE_SUPERUSER=${CREATE_SUPERUSER}
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  ui:
    image: rustrak/rustrak-ui:latest
    ports:
      - "${UI_PORT}:3000"
    environment:
      - RUSTRAK_API_URL=${RUSTRAK_API_URL}
    depends_on:
      - server
    restart: unless-stopped

volumes:
  postgres_data:
```

#### 2. Create `.env` file

```bash
# Database
POSTGRES_USER=rustrak
POSTGRES_PASSWORD=rustrak
POSTGRES_DB=rustrak

# Server
SERVER_PORT=8080
RUST_LOG=info
SESSION_SECRET_KEY=<run: openssl rand -hex 32>
CREATE_SUPERUSER=admin@example.com:changeme123

# Dashboard
UI_PORT=3000
RUSTRAK_API_URL=http://server:8080
```

#### 3. Start Rustrak

```bash
docker compose up -d
```

Open http://localhost:3000 and login with your `CREATE_SUPERUSER` credentials

![ezgif-3519bd2e7e178ab7](https://github.com/user-attachments/assets/112376f3-67cf-440c-a8ab-fab6b74c9eb4)


## Connect Your App

Create a project in the UI, copy your DSN, and add it to your application:

```python
# Python
import sentry_sdk
sentry_sdk.init(dsn="http://<key>@localhost:8080/<project_id>")
```

```javascript
// JavaScript
import * as Sentry from "@sentry/browser";
Sentry.init({ dsn: "http://<key>@localhost:8080/<project_id>" });
```

```go
// Go
sentry.Init(sentry.ClientOptions{Dsn: "http://<key>@localhost:8080/<project_id>"})
```

Works with **any** Sentry SDK - no code changes needed if you're migrating from Sentry.

## SDKs & Integrations

Official packages for programmatic access and AI assistant integration:

| Package | Version | Description |
|---|---|---|
| [`@rustrak/client`](https://www.npmjs.com/package/@rustrak/client) | [![npm](https://img.shields.io/npm/v/@rustrak/client?style=flat-square)](https://www.npmjs.com/package/@rustrak/client) | Type-safe TypeScript client for the Rustrak REST API |
| [`@rustrak/mcp`](https://www.npmjs.com/package/@rustrak/mcp) | [![npm](https://img.shields.io/npm/v/@rustrak/mcp?style=flat-square)](https://www.npmjs.com/package/@rustrak/mcp) | MCP server — lets Claude, Cursor, and Continue manage your Rustrak instance |

```bash
# Use the REST API from TypeScript/Node.js
npm install @rustrak/client

# Connect your AI assistant (Claude Desktop, Cursor, Continue.dev)
npx @rustrak/mcp
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Sentry SDK    │────▶│  Rustrak Server │────▶│  PostgreSQL  │
│   (your app)    │     │   (Rust/Actix)  │     │              │
└─────────────────┘     └─────────────────┘     └──────────────┘
                               │
                               ▼
                        ┌─────────────┐
                        │  Rustrak UI │
                        │  (Next.js)  │
                        └─────────────┘
```

| Component | Tech | Purpose |
|-----------|------|---------|
| Server | Rust + Actix-web | API & event ingestion |
| UI | Next.js 16 | Dashboard |
| Database | SQLite or PostgreSQL | Storage |

## Docker Images

> **Migrating from v0.x?** Images moved from `abians7/rustrak-*` to `rustrak/rustrak-*` starting from v0.4.0.
> Update your `docker-compose.yml` image references and pull from the new location.
> Old images on `abians7` remain available but will no longer receive updates.

Available on Docker Hub:

```bash
docker pull rustrak/rustrak-server         # SQLite (default)
docker pull rustrak/rustrak-server:postgres # PostgreSQL
docker pull rustrak/rustrak-ui
```

| Image | Tag | Size | Description |
|-------|-----|------|-------------|
| `rustrak-server` | `latest`, `vX.Y.Z` | ~20MB | SQLite backend (no external DB) |
| `rustrak-server` | `postgres`, `vX.Y.Z-postgres` | ~20MB | PostgreSQL backend |
| `rustrak-ui` | `latest`, `vX.Y.Z` | ~50MB | Next.js dashboard |

## Development

```bash
# Prerequisites: Rust, Node.js 20+, pnpm, Docker

# Install dependencies
pnpm install

# Start PostgreSQL
docker-compose -f docker-compose.dev.yml up -d postgres

# Run server (terminal 1)
cd apps/server && cargo run

# Run UI (terminal 2)
cd apps/webview-ui && pnpm dev
```

### API Reference (OpenAPI spec)

The interactive API explorer is served by the server at `/docs` when built with the `openapi` feature, and is also embedded in the documentation site.

**The spec file must be regenerated and committed whenever the API changes** (new endpoints, changed request/response shapes, added parameters):

```bash
cd apps/server
cargo run --bin gen_openapi --features openapi
git add openapi.json
git commit -m "chore(openapi): update spec"
```

The docs site copies the spec automatically at build time — `apps/docs/public/openapi.json` is not committed.

## Documentation

Full documentation is available at **[docs](https://rustrak.github.io/rustrak/)**

- [Getting Started](https://rustrak.github.io/rustrak/getting-started/overview)
- [Configuration](https://rustrak.github.io/rustrak/configuration/environment)
- [API Reference](https://rustrak.github.io/rustrak/reference/api)
- [Self-Hosting Guide](https://rustrak.github.io/rustrak/getting-started/installation)

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a PR.

```bash
# Run tests
pnpm test

# Run linter
pnpm lint

# Format code
pnpm format
```

## License

Copyright (C) 2026 Abian Suarez

GPL-3.0 License - see [LICENSE](LICENSE) for details.

