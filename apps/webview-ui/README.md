# Rustrak UI

Next.js dashboard for Rustrak error tracking system.

## Features

- Project management
- Issue browsing with pagination
- Event details with stack traces
- Breadcrumbs and context visualization
- API token management
- Dark/light theme support

## Requirements

- Node.js 20+
- pnpm 9+

## Quick Start

```bash
# Install dependencies
pnpm install

# Set environment variables
export RUSTRAK_API_URL="http://localhost:8080"

# Run development server
pnpm dev
```

```bash
docker pull rustrak/rustrak-ui
docker run -d -p 3000:3000 \
  -e RUSTRAK_API_URL="http://your-server:8080" \
  rustrak/rustrak-ui
```

### Behind a reverse proxy (no port exposure)

You don't need to expose a host port. Let the proxy route by host header
and keep the container on the internal Docker network:

```bash
docker run -d --network rustrak \
  -e HOSTNAME=0.0.0.0 \
  -e RUSTRAK_API_URL=http://server:8080 \
  rustrak/rustrak-ui
```

Or with docker-compose, remove the `ports` section from the `ui` service
and put it behind Traefik/nginx/Caddy.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RUSTRAK_API_URL` | Yes | - | Rustrak server URL (e.g. `http://server:8080` internally, or `https://api.example.com` via proxy) |
| `HOSTNAME` | No | `0.0.0.0` | Bind address for Next.js standalone server. `0.0.0.0` is correct inside Docker |
| `HOST` | No | `0.0.0.0` | Alias for `HOSTNAME` (compatibility). If `HOSTNAME` is unset, `HOST` is used |
| `PORT` | No | `3000` | Port the UI listens on inside the container |
## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5.9
- **Styling**: Tailwind CSS 4
- **UI Components**: Radix UI + shadcn/ui
- **Theme**: next-themes

## Development

```bash
# Run development server
pnpm dev

# Type check
pnpm check-types

# Lint
pnpm lint

# Build
pnpm build
```

## Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── auth/            # Login page
│   └── (main)/          # Protected routes
│       ├── projects/    # Projects & issues
│       └── settings/    # Settings pages
├── actions/             # Server Actions
├── components/          # React components
│   └── ui/              # shadcn/ui components
└── lib/                 # Utilities
```

## License

GPL-3.0
