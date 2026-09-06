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

## Docker

```bash
docker pull rustrak/rustrak-ui
docker run -d -p 3000:3000 \
  -e RUSTRAK_API_URL="http://your-server:8080" \
  rustrak/rustrak-ui
```

### Behind a reverse proxy

The image binds to `0.0.0.0`, so a proxy on the same Docker network reaches it
on port `3000` with nothing published to the host. Drop the `-p` and join the
network the proxy is on:

```bash
docker network create rustrak                       # once
docker run -d --network rustrak --name ui \
  -e RUSTRAK_API_URL=http://server:8080 \
  rustrak/rustrak-ui
```

`RUSTRAK_API_URL` stays internal here. The dashboard calls the server
server-side, so that request never leaves the network, and pointing it at your
public domain breaks sign-in. With Compose, delete the `ports:` block from the
`ui` service and route by host in Traefik, nginx or Caddy. The full setup,
including the DSN, is in
[Reverse proxy](https://rustrak.github.io/rustrak/configuration/production#reverse-proxy).

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RUSTRAK_API_URL` | Yes | `http://localhost:8080` | Address the dashboard uses to reach the server. Always an internal one |
| `PORT` | No | `3000` | Port the dashboard listens on inside the container |
| `HOSTNAME` | No | `0.0.0.0` | TCP bind address. Already correct in the image, and not something to forward from the host environment |

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
