<div align="center">
  <img src="apps/docs/public/logo.svg" alt="Rustrak" width="80" height="80" />
  <h1>Rustrak</h1>
  <p><strong>Ultra-lightweight, self-hosted error tracking compatible with Sentry SDKs</strong></p>

  <p>
    <a href="https://github.com/AbianS/rustrak/actions/workflows/ci.yml">
      <img src="https://github.com/AbianS/rustrak/actions/workflows/ci.yml/badge.svg" alt="CI" />
    </a>
    <a href="https://github.com/AbianS/rustrak/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/license-GPL--3.0-blue.svg" alt="License" />
    </a>
    <a href="https://github.com/AbianS/rustrak/releases">
      <img src="https://img.shields.io/github/v/release/AbianS/rustrak" alt="Release" />
    </a>
  </p>

  <p>
    <a href="https://abians.github.io/rustrak">Documentation</a>
    ·
    <a href="https://github.com/AbianS/rustrak/issues">Report Bug</a>
    ·
    <a href="https://github.com/AbianS/rustrak/issues">Request Feature</a>
  </p>
</div>

---

## Why Rustrak?

Most error tracking solutions are either expensive SaaS products or heavy self-hosted applications. Rustrak is different:

- **Sentry Compatible** - Works with any existing Sentry SDK (Python, JavaScript, Go, Rust, etc.)
- **Lightweight** - Server runs with ~50MB memory footprint
- **Fast** - <50ms P99 ingestion latency, 10k+ events/second
- **Simple** - Single binary + PostgreSQL, no Redis or complex infrastructure

<img width="1280" height="412" alt="Frame 2" src="https://github.com/user-attachments/assets/7ba6664b-7352-4955-8943-b1429d7491cd" />

## Quick Start

### 1. Create `docker-compose.yml`

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
    image: abians7/rustrak-server:latest
    ports:
      - "${SERVER_PORT}:8080"
    environment:
      - HOST=0.0.0.0
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
    image: abians7/rustrak-ui:latest
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

### 2. Create `.env` file

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

### 3. Start Rustrak

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
| Database | PostgreSQL 16 | Storage |

## Docker Images

Available on Docker Hub:

```bash
docker pull abians7/rustrak-server
docker pull abians7/rustrak-ui
```

| Image | Size | Description |
|-------|------|-------------|
| `rustrak-server` | ~20MB | API & event ingestion |
| `rustrak-ui` | ~50MB | Next.js dashboard |

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

## Documentation

Full documentation is available at **[rustrak.dev](https://rustrak.dev)**

- [Getting Started](https://rustrak.dev/getting-started)
- [Configuration](https://rustrak.dev/configuration)
- [API Reference](https://rustrak.dev/api)
- [Self-Hosting Guide](https://rustrak.dev/self-hosting)

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

GPL-3.0 License - see [LICENSE](LICENSE) for details.

