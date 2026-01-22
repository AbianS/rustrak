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
docker pull abians7/rustrak-ui
docker run -d -p 3000:3000 \
  -e RUSTRAK_API_URL="http://your-server:8080" \
  abians7/rustrak-ui
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RUSTRAK_API_URL` | Yes | - | Rustrak server URL |

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
