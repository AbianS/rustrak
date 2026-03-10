# Deployment Guide

> Generated: 2026-03-10 | Scan level: deep

## Overview

Rustrak has a **decoupled deployment architecture**: the server and dashboard can be deployed independently.

| Component | Docker Image | RAM | Disk |
|-----------|-------------|-----|------|
| Server (SQLite) | `abians7/rustrak-server:latest` | ~50MB | ~20MB image |
| Server (PostgreSQL) | `abians7/rustrak-server:postgres` | ~50MB | ~20MB image |
| Dashboard | `abians7/rustrak-ui:latest` | ~100MB | ~150MB image |
| Docs | GitHub Pages | — | static |

**Supported architectures:** `linux/amd64`, `linux/arm64`

---

## Deployment Options

### Option 1: Full Stack (Docker Compose) — Recommended for Teams

Runs server + dashboard + PostgreSQL on one machine.

```yaml
# docker-compose.yml
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
    image: abians7/rustrak-server:postgres
    ports:
      - "${SERVER_PORT}:8080"
    environment:
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

**Setup:**
```bash
# Create .env file
cat > .env <<EOF
POSTGRES_USER=rustrak
POSTGRES_PASSWORD=$(openssl rand -hex 16)
POSTGRES_DB=rustrak
SERVER_PORT=8080
UI_PORT=3000
RUSTRAK_API_URL=http://localhost:8080
SESSION_SECRET_KEY=$(openssl rand -hex 32)
CREATE_SUPERUSER=admin@example.com:$(openssl rand -hex 12)
EOF

# Start stack
docker-compose up -d

# Check logs
docker-compose logs -f server
```

---

### Option 2: Server Only + SQLite — Minimal (Personal / Hobby)

Single container, no external database, zero-ops setup.

```bash
docker run -d \
  --name rustrak-server \
  -p 8080:8080 \
  -v rustrak-data:/data \
  -e DATABASE_URL=sqlite:/data/rustrak.db \
  -e SESSION_SECRET_KEY=$(openssl rand -hex 32) \
  -e CREATE_SUPERUSER=admin@example.com:your-password \
  -e INGEST_DIR=/tmp/rustrak/ingest \
  --restart unless-stopped \
  abians7/rustrak-server:latest
```

Access dashboard at: http://localhost:8080 (server only) or run UI separately.

---

### Option 3: Server Only + External Dashboard — Low Resource

Best for VPS with limited RAM (~512MB). Server stays lean (~50MB), dashboard runs locally or on Vercel.

```bash
# Server on VPS
docker run -d \
  --name rustrak \
  -p 8080:8080 \
  -e DATABASE_URL=postgres://user:pass@db:5432/rustrak \
  -e SESSION_SECRET_KEY=$(openssl rand -hex 32) \
  -e CREATE_SUPERUSER=admin@example.com:password \
  -e SSL_PROXY=true \
  --restart unless-stopped \
  abians7/rustrak-server:postgres
```

```bash
# Dashboard locally (or deploy to Vercel free tier)
RUSTRAK_API_URL=https://your-server.com pnpm dev
```

---

## Production Checklist

### Security

```bash
# Required: generate strong session secret
SESSION_SECRET_KEY=$(openssl rand -hex 32)

# Required if behind HTTPS proxy (nginx, Cloudflare, Vercel)
SSL_PROXY=true

# Use a secure admin password on first run
CREATE_SUPERUSER=admin@yourdomain.com:$(openssl rand -hex 16)
# IMPORTANT: After creating, remove CREATE_SUPERUSER from env
```

### HTTPS / Reverse Proxy (nginx example)

```nginx
server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

When behind HTTPS proxy, set:
```bash
SSL_PROXY=true
SESSION_SECRET_KEY=<64-hex-chars>
```

### Rate Limiting

Default limits (adjust based on your traffic):
```bash
MAX_EVENTS_PER_MINUTE=1000
MAX_EVENTS_PER_HOUR=10000
MAX_EVENTS_PER_PROJECT_PER_MINUTE=500
MAX_EVENTS_PER_PROJECT_PER_HOUR=5000
```

---

## Configuring Your Sentry SDK

After deploying, configure your application's Sentry SDK:

1. **Create a project** in the Rustrak dashboard → Settings → Tokens, or via API
2. **Get the DSN** from the project settings: `http://<sentry_key>@<host>/<project_id>`
3. **Replace** your existing Sentry DSN with the Rustrak DSN

**Python:**
```python
import sentry_sdk
sentry_sdk.init(dsn="http://<key>@api.your-domain.com/1")
```

**JavaScript/Node:**
```javascript
import * as Sentry from "@sentry/node";
Sentry.init({ dsn: "http://<key>@api.your-domain.com/1" });
```

**Next.js:**
```javascript
// sentry.client.config.js
Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN });
```

---

## CI/CD — Release Process

Releases are managed via [Changesets](https://github.com/changesets/changesets).

### Create a release

```bash
# 1. Create a changeset describing your changes
pnpm changeset

# 2. Commit and push
git add .changeset/
git commit -m "chore: add changeset"
git push origin feat/my-feature

# 3. Merge PR to main
# → GitHub Actions auto-creates "Version Packages" PR

# 4. Review and merge Version PR
# → Actions auto-creates release tags per package

# 5. Tags trigger Docker builds:
#    @rustrak/server@X.Y.Z → builds server Docker images
#    webview-ui@X.Y.Z      → builds UI Docker image
#    docs@X.Y.Z            → deploys to GitHub Pages
```

### Docker images published

| Tag | Description |
|-----|-------------|
| `abians7/rustrak-server:latest` | Latest SQLite build |
| `abians7/rustrak-server:vX.Y.Z` | Specific SQLite version |
| `abians7/rustrak-server:postgres` | Latest PostgreSQL build |
| `abians7/rustrak-server:vX.Y.Z-postgres` | Specific PostgreSQL version |
| `abians7/rustrak-ui:latest` | Latest UI build |
| `abians7/rustrak-ui:vX.Y.Z` | Specific UI version |

All images are multi-arch (`linux/amd64` + `linux/arm64`).

---

## Updating

```bash
# Pull latest images
docker-compose pull

# Restart services
docker-compose up -d

# Or with zero downtime (rolling restart)
docker-compose up -d --no-deps server
docker-compose up -d --no-deps ui
```

Database migrations run automatically on server startup.

---

## Monitoring

### Health checks

```bash
# Liveness
curl http://localhost:8080/health
# → 200 OK {"status": "ok"}

# Readiness (DB connectivity)
curl http://localhost:8080/health/ready
# → 200 OK if DB is up, 503 if not
```

### Logs

```bash
# Docker Compose
docker-compose logs -f server

# Set log level
RUST_LOG=debug docker-compose up server
# RUST_LOG options: trace, debug, info, warn, error
```

### Rate limit monitoring

The server returns `429` with `Retry-After` header when rate limited. Monitor for high 429 rates to detect event floods.

---

## Backup

### SQLite
```bash
# Backup
docker exec rustrak-server cp /data/rustrak.db /data/rustrak.db.backup
docker cp rustrak-server:/data/rustrak.db ./rustrak-backup-$(date +%Y%m%d).db
```

### PostgreSQL
```bash
docker exec postgres pg_dump -U rustrak rustrak > backup-$(date +%Y%m%d).sql
```
