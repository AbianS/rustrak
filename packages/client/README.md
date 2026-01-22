# @rustrak/client

TypeScript client for the Rustrak error tracking API. Provides a type-safe, fully-featured interface for interacting with Rustrak's REST API.

## Features

- **Type-Safe**: Full TypeScript support with runtime validation using Zod
- **Lightweight**: ~28KB total bundle size (ky 3KB + zod 10KB + client 15KB)
- **Automatic Retry**: Built-in retry logic for transient failures
- **Error Handling**: Structured error classes for different failure scenarios
- **Pagination**: First-class support for cursor-based pagination

## Installation

```bash
pnpm add @rustrak/client
```

## Quick Start

```typescript
import { RustrakClient } from '@rustrak/client';

const client = new RustrakClient({
  baseUrl: 'http://localhost:8080',
  token: 'your-api-token',
});

// List all projects
const projects = await client.projects.list();

// Get issues for a project
const { items, next_cursor, has_more } = await client.issues.list(1);

// Get events for an issue
const events = await client.events.list(1, 'issue-uuid');
```

## Usage

### Configuration

```typescript
import { RustrakClient } from '@rustrak/client';

const client = new RustrakClient({
  baseUrl: 'https://rustrak.example.com',
  token: 'your-bearer-token',
  timeout: 30000, // Optional: request timeout in ms (default: 30000)
  maxRetries: 2, // Optional: max retry attempts (default: 2)
  headers: {
    // Optional: custom headers
    'X-Custom-Header': 'value',
  },
});
```

### Projects

```typescript
// List all projects
const projects = await client.projects.list();

// Get a single project
const project = await client.projects.get(1);

// Create a project
const newProject = await client.projects.create({
  name: 'My App',
  slug: 'my-app', // Optional
});

// Update a project
const updated = await client.projects.update(1, {
  name: 'Updated Name',
});

// Delete a project
await client.projects.delete(1);
```

### Issues

```typescript
// List issues with pagination
const response = await client.issues.list(projectId, {
  sort: 'last_seen', // 'digest_order' | 'last_seen'
  order: 'desc', // 'asc' | 'desc'
  include_resolved: false,
  cursor: 'eyJzb3J0...', // Optional: pagination cursor
});

// Paginate through all issues
let cursor: string | undefined;
do {
  const { items, next_cursor, has_more } = await client.issues.list(projectId, {
    cursor,
  });

  // Process items...
  cursor = next_cursor;
} while (cursor);

// Get a single issue
const issue = await client.issues.get(projectId, issueId);

// Update issue state
const resolved = await client.issues.updateState(projectId, issueId, {
  is_resolved: true,
  is_muted: false,
});

// Delete an issue
await client.issues.delete(projectId, issueId);
```

### Events

```typescript
// List events for an issue
const { items, next_cursor } = await client.events.list(projectId, issueId, {
  order: 'desc',
  cursor: 'optional-cursor',
});

// Get event details
const event = await client.events.get(projectId, issueId, eventId);

// Access full Sentry event data
console.log(event.data); // Full JSON payload
```

### Auth Tokens

```typescript
// List tokens (masked)
const tokens = await client.tokens.list();

// Get a single token (masked)
const token = await client.tokens.get(1);

// Create a token (full token only shown once!)
const created = await client.tokens.create({
  description: 'CI/CD token',
});
console.log(created.token); // Save this! Won't be shown again

// Delete a token
await client.tokens.delete(1);
```

## Error Handling

The client throws structured error classes for different scenarios:

```typescript
import {
  RustrakError,
  NetworkError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ValidationError,
} from '@rustrak/client';

try {
  await client.projects.list();
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof AuthenticationError) {
    console.log('Invalid token');
  } else if (error instanceof NotFoundError) {
    console.log('Resource not found');
  } else if (error instanceof NetworkError) {
    console.log('Network error - will retry automatically');
  } else if (error instanceof ValidationError) {
    console.log('API response validation failed');
    console.log(error.getValidationDetails());
  }
}
```

### Error Types

| Error Class | HTTP Status | Retryable | Use Case |
|-------------|-------------|-----------|----------|
| `NetworkError` | - | ✅ | Connection issues, timeouts |
| `AuthenticationError` | 401 | ❌ | Invalid credentials |
| `AuthorizationError` | 403 | ❌ | Insufficient permissions |
| `NotFoundError` | 404 | ❌ | Resource doesn't exist |
| `BadRequestError` | 400 | ❌ | Invalid request payload |
| `RateLimitError` | 429 | ✅ | Rate limit exceeded |
| `ServerError` | 500+ | ✅ | Server-side errors |
| `ValidationError` | - | ❌ | Response schema mismatch |

## Usage with Next.js

### Server Component

```typescript
import { RustrakClient } from '@rustrak/client';

export default async function ProjectsPage() {
  const client = new RustrakClient({
    baseUrl: process.env.RUSTRAK_API_URL!,
    token: process.env.RUSTRAK_API_TOKEN!,
  });

  const projects = await client.projects.list();

  return (
    <div>
      {projects.map((project) => (
        <div key={project.id}>{project.name}</div>
      ))}
    </div>
  );
}
```

### Client Component with SWR

```typescript
'use client';

import useSWR from 'swr';
import { RustrakClient } from '@rustrak/client';

const client = new RustrakClient({
  baseUrl: process.env.NEXT_PUBLIC_RUSTRAK_API_URL!,
  token: process.env.NEXT_PUBLIC_RUSTRAK_API_TOKEN!,
});

export function IssuesList({ projectId }: { projectId: number }) {
  const { data, error, isLoading } = useSWR(
    ['issues', projectId],
    () => client.issues.list(projectId)
  );

  if (error) return <div>Error: {error.message}</div>;
  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {data?.items.map((issue) => (
        <div key={issue.id}>{issue.title}</div>
      ))}
    </div>
  );
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

  return await client.issues.updateState(projectId, issueId, {
    is_resolved: true,
  });
}
```

## TypeScript

The client is written in TypeScript with strict mode enabled. All types are exported:

```typescript
import type {
  Project,
  Issue,
  Event,
  EventDetail,
  PaginatedResponse,
  CreateProject,
  UpdateIssueState,
} from '@rustrak/client';

const project: Project = await client.projects.get(1);
const issues: PaginatedResponse<Issue> = await client.issues.list(1);
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Type check
pnpm check-types

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage
pnpm test:coverage
```

## License

GPL-3.0
