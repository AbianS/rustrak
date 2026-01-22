# Rustrak Server

Rust API server for Rustrak error tracking system. Compatible with Sentry SDKs.

## Features

- Sentry envelope protocol support
- Two-phase event ingestion (fast ingest + async digest)
- Issue grouping with custom fingerprints
- Rate limiting (per-project and global)
- Session-based authentication for web UI
- Token authentication for API access

## Requirements

- Rust 1.75+
- PostgreSQL 16+

## Quick Start

```bash
# Set environment variables
export DATABASE_URL="postgres://user:pass@localhost:5432/rustrak"
export SESSION_SECRET_KEY="$(openssl rand -hex 32)"
export CREATE_SUPERUSER="admin@example.com:password123"

# Run
cargo run
```

## Docker

```bash
docker pull abians7/rustrak-server
docker run -d -p 8080:8080 \
  -e DATABASE_URL="postgres://user:pass@localhost:5432/rustrak" \
  -e SESSION_SECRET_KEY="your-secret-key" \
  abians7/rustrak-server
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `SESSION_SECRET_KEY` | Production | - | 64-char hex key for sessions |
| `HOST` | No | `0.0.0.0` | Server bind address |
| `PORT` | No | `8080` | Server port |
| `RUST_LOG` | No | `info` | Log level |
| `CREATE_SUPERUSER` | No | - | Create admin user `email:password` |
| `SSL_PROXY` | No | `false` | Enable secure cookies (behind HTTPS) |

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/{project_id}/envelope/` | POST | Sentry | Event ingestion |
| `/api/projects` | GET/POST | Bearer | List/create projects |
| `/api/projects/{id}` | GET/PATCH/DELETE | Bearer | Project CRUD |
| `/api/projects/{id}/issues` | GET | Bearer | List issues |
| `/api/projects/{id}/issues/{issueId}` | GET/PATCH/DELETE | Bearer | Issue CRUD |
| `/auth/login` | POST | - | Session login |
| `/auth/logout` | POST | Session | Session logout |
| `/health` | GET | - | Health check |

## Development

```bash
# Run tests
cargo test

# Run with hot reload
cargo watch -x run

# Format code
cargo fmt

# Lint
cargo clippy
```

## License

GPL-3.0
