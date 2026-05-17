<div align="center">
  <a href="https://abians.github.io/rustrak">
    <img src="https://raw.githubusercontent.com/AbianS/rustrak/main/apps/docs/public/logo.svg" alt="Rustrak" width="64" height="64" />
  </a>
  <h1>@rustrak/client</h1>
  <p>Official TypeScript client for the <a href="https://abians.github.io/rustrak">Rustrak</a> self-hosted error tracking API</p>

  <p>
    <a href="https://www.npmjs.com/package/@rustrak/client">
      <img src="https://img.shields.io/npm/v/@rustrak/client?style=flat-square&color=cb3837" alt="npm version" />
    </a>
    <a href="https://www.npmjs.com/package/@rustrak/client">
      <img src="https://img.shields.io/npm/dw/@rustrak/client?style=flat-square" alt="weekly downloads" />
    </a>
    <a href="https://bundlephobia.com/package/@rustrak/client">
      <img src="https://img.shields.io/bundlephobia/minzip/@rustrak/client?style=flat-square&label=bundle" alt="bundle size" />
    </a>
    <a href="https://github.com/AbianS/rustrak/blob/main/LICENSE">
      <img src="https://img.shields.io/npm/l/@rustrak/client?style=flat-square" alt="license" />
    </a>
    <a href="https://github.com/AbianS/rustrak/actions/workflows/ci.yml">
      <img src="https://img.shields.io/github/actions/workflow/status/AbianS/rustrak/ci.yml?style=flat-square&label=CI" alt="CI" />
    </a>
  </p>

  <p>
    <a href="https://abians.github.io/rustrak/sdks/client">Documentation</a>
    ·
    <a href="https://github.com/AbianS/rustrak">GitHub</a>
    ·
    <a href="https://github.com/AbianS/rustrak/issues">Report a Bug</a>
  </p>
</div>

---

`@rustrak/client` is the official TypeScript client for [Rustrak](https://abians.github.io/rustrak) — an ultra-lightweight, self-hosted error tracking system compatible with any Sentry SDK. This package wraps the Rustrak REST API with full type safety, runtime validation via Zod, built-in retry logic, and structured error handling. Total bundle size: ~28 KB.

## Installation

```bash
npm install @rustrak/client
# or
pnpm add @rustrak/client
# or
yarn add @rustrak/client
```

**Requirements**: Node.js ≥ 18, TypeScript ≥ 5

## Quick Start

```typescript
import { RustrakClient } from '@rustrak/client';

const client = new RustrakClient({
  baseUrl: 'https://your-rustrak-instance.example.com',
  token: process.env.RUSTRAK_API_TOKEN!,
});

// List all projects
const projects = await client.projects.list();

// Paginate through open issues
const { items, next_cursor, has_more } = await client.issues.list(1, {
  sort: 'last_seen',
  order: 'desc',
});

// Resolve an issue
await client.issues.updateState(1, 'issue-id', { is_resolved: true });
```

**[Full documentation →](https://abians.github.io/rustrak/sdks/client)**

## Features

- **Type-safe** — All API responses validated at runtime with Zod; types are inferred from schemas
- **Lightweight** — ~28 KB total (ky 3 KB + zod 10 KB + client 15 KB)
- **Automatic retry** — Exponential backoff on transient failures (408, 429, 5xx)
- **Structured errors** — Typed error classes for every HTTP status and failure mode
- **Cursor pagination** — First-class support for paginated responses across all list endpoints
- **97% test coverage** — 133 tests (unit + integration with MSW)

## API Reference

### Configuration

```typescript
const client = new RustrakClient({
  baseUrl: 'https://rustrak.example.com', // required
  token: 'your-bearer-token',             // required
  timeout: 30000,                         // optional, ms (default: 30000)
  maxRetries: 2,                          // optional (default: 2)
  headers: {},                            // optional custom headers
});
```

### Projects

```typescript
const projects = await client.projects.list();
const project  = await client.projects.get(1);
const created  = await client.projects.create({ name: 'My App', slug: 'my-app' });
const updated  = await client.projects.update(1, { name: 'New Name' });
await client.projects.delete(1);
```

### Issues

```typescript
// List with filters and cursor pagination
const { items, next_cursor, has_more } = await client.issues.list(projectId, {
  sort: 'last_seen',        // 'digest_order' | 'last_seen'
  order: 'desc',            // 'asc' | 'desc'
  include_resolved: false,
  cursor: 'eyJzb3J0...',    // from previous response
});

const issue = await client.issues.get(projectId, issueId);
await client.issues.updateState(projectId, issueId, { is_resolved: true });
await client.issues.delete(projectId, issueId);
```

### Events

```typescript
const { items } = await client.events.list(projectId, issueId, { order: 'desc' });
const event     = await client.events.get(projectId, issueId, eventId);
console.log(event.data); // Full Sentry event payload
```

### Auth Tokens

```typescript
const tokens  = await client.tokens.list();
const created = await client.tokens.create({ description: 'CI token' });
console.log(created.token); // Save this — shown only once
await client.tokens.delete(1);
```

## Error Handling

```typescript
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  NetworkError,
  ServerError,
  ValidationError,
} from '@rustrak/client';

try {
  await client.projects.list();
} catch (error) {
  if (error instanceof RateLimitError)       console.log(`Retry after ${error.retryAfter}s`);
  else if (error instanceof AuthenticationError) redirect('/login');
  else if (error instanceof NotFoundError)   console.log('Not found');
  else if (error instanceof NetworkError)    console.log('Will retry automatically');
  else if (error instanceof ValidationError) console.log(error.getValidationDetails());
}
```

| Error Class | HTTP | Retryable |
|---|---|---|
| `NetworkError` | — | ✅ |
| `AuthenticationError` | 401 | ❌ |
| `AuthorizationError` | 403 | ❌ |
| `NotFoundError` | 404 | ❌ |
| `BadRequestError` | 400 | ❌ |
| `RateLimitError` | 429 | ✅ |
| `ServerError` | 500+ | ✅ |
| `ValidationError` | — | ❌ |

## Next.js Integration

### Server Component

```typescript
import { RustrakClient } from '@rustrak/client';

export default async function ProjectsPage() {
  const client = new RustrakClient({
    baseUrl: process.env.RUSTRAK_API_URL!,
    token: process.env.RUSTRAK_API_TOKEN!,
  });
  const projects = await client.projects.list();
  return <ProjectsList projects={projects} />;
}
```

### Server Action

```typescript
'use server';
import { RustrakClient } from '@rustrak/client';

export async function resolveIssue(projectId: number, issueId: string) {
  const client = new RustrakClient({
    baseUrl: process.env.RUSTRAK_API_URL!,
    token: process.env.RUSTRAK_API_TOKEN!,
  });
  return client.issues.updateState(projectId, issueId, { is_resolved: true });
}
```

## TypeScript

All types are exported and inferred from Zod schemas — single source of truth:

```typescript
import type {
  Project,
  Issue,
  Event,
  EventDetail,
  AuthToken,
  PaginatedResponse,
  CreateProject,
  UpdateIssueState,
} from '@rustrak/client';
```

## Related Packages

| Package | Description |
|---|---|
| [`@rustrak/mcp`](https://www.npmjs.com/package/@rustrak/mcp) | MCP server — gives Claude Desktop, Cursor, and Continue direct access to your Rustrak instance via 18 tools |

## What is Rustrak?

[Rustrak](https://abians.github.io/rustrak) is a self-hosted error tracking server written in Rust that is fully compatible with any Sentry SDK. Drop-in replacement for Sentry — no code changes needed. Runs on ~50 MB of memory as a single binary or Docker image.

- [Getting Started](https://abians.github.io/rustrak/getting-started/overview)
- [Self-Hosting Guide](https://abians.github.io/rustrak/configuration/production)
- [API Reference](https://abians.github.io/rustrak/api-reference)
- [GitHub](https://github.com/AbianS/rustrak)

## License

[GPL-3.0](https://github.com/AbianS/rustrak/blob/main/LICENSE)
