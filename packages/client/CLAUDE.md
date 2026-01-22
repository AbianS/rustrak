# Rustrak Client - TypeScript API Client

> **Context Note**: This is the **client package context** for Rustrak.
> - Root context: `/CLAUDE.md`
> - Server API: `apps/server/CLAUDE.md`
> - WebView UI: `apps/webview-ui/CLAUDE.md`

## Overview

`@rustrak/client` is a type-safe TypeScript client for the Rustrak REST API. It provides a fully-typed interface for consuming the Rustrak error tracking API from any TypeScript/JavaScript environment (Node.js, Next.js, browsers).

**Key Features:**
- ✅ Full TypeScript support with runtime validation (Zod)
- ✅ Lightweight (~28KB: ky 3KB + zod 10KB + client 15KB)
- ✅ Automatic retry logic for transient failures
- ✅ Structured error handling
- ✅ Cursor-based pagination support
- ✅ 97% test coverage (133 tests)

## Architecture

```
┌─────────────────────┐
│  Consumer App       │
│  (Next.js/Node.js)  │
└──────────┬──────────┘
           │
           │ @rustrak/client
           ▼
┌─────────────────────┐
│  RustrakClient      │  ← Main client class
│  ├── projects       │  ← ProjectsResource
│  ├── issues         │  ← IssuesResource
│  ├── events         │  ← EventsResource
│  └── tokens         │  ← TokensResource
└──────────┬──────────┘
           │
           │ HTTP (ky)
           ▼
┌─────────────────────┐
│  Rustrak Server     │
│  (Rust/Actix-web)   │
└─────────────────────┘
```

## Tech Stack

- **HTTP Client**: [ky](https://github.com/sindresorhus/ky) v1.14+ (~3KB, TypeScript-native)
- **Validation**: [Zod](https://zod.dev) v4+ (~10KB, runtime type safety)
- **Build Tool**: [tsup](https://tsup.egoist.dev) (esbuild-based, fast)
- **Testing**: [Vitest](https://vitest.dev) + [MSW](https://mswjs.io) (Mock Service Worker)
- **TypeScript**: v5.9+ (strict mode)

## Project Structure

```
packages/client/
├── CLAUDE.md              # This file
├── README.md              # Usage documentation
├── package.json           # @rustrak/client
├── tsconfig.json          # Strict TypeScript config
├── tsup.config.ts         # Build config (ESM + CJS + DTS)
├── vitest.config.ts       # Test config
│
├── src/
│   ├── index.ts           # Public API exports
│   ├── client.ts          # RustrakClient main class
│   ├── config.ts          # ClientConfig interface
│   │
│   ├── types/             # TypeScript types (inferred from Zod schemas)
│   │   ├── common.ts      # PaginatedResponse, SortOrder, etc.
│   │   ├── project.ts     # Project, CreateProject, UpdateProject
│   │   ├── issue.ts       # Issue, UpdateIssueState
│   │   ├── event.ts       # Event, EventDetail
│   │   └── token.ts       # AuthToken, CreateAuthToken
│   │
│   ├── schemas/           # Zod schemas (source of truth)
│   │   ├── common.ts      # paginatedResponseSchema, sortOrderSchema
│   │   ├── project.ts     # projectSchema, createProjectSchema
│   │   ├── issue.ts       # issueSchema, updateIssueStateSchema
│   │   ├── event.ts       # eventSchema, eventDetailSchema
│   │   └── token.ts       # authTokenSchema, createAuthTokenSchema
│   │
│   ├── errors/            # Custom error classes
│   │   ├── base.ts        # RustrakError (base class)
│   │   ├── http.ts        # HTTP errors (401, 404, 429, 500, etc.)
│   │   └── validation.ts  # ValidationError (schema mismatch)
│   │
│   ├── resources/         # API resource classes
│   │   ├── base.ts        # BaseResource (with validate helper)
│   │   ├── projects.ts    # ProjectsResource (CRUD)
│   │   ├── issues.ts      # IssuesResource (list, get, updateState, delete)
│   │   ├── events.ts      # EventsResource (list, get)
│   │   └── tokens.ts      # TokensResource (CRUD)
│   │
│   └── utils/
│       └── http.ts        # createKyInstance (ky setup with hooks)
│
├── tests/
│   ├── setup.ts           # MSW server setup
│   ├── mocks/
│   │   └── handlers.ts    # MSW request handlers
│   │
│   ├── unit/              # Unit tests (39 tests)
│   │   ├── schemas.test.ts
│   │   └── errors.test.ts
│   │
│   └── integration/       # Integration tests (94 tests)
│       ├── client.test.ts
│       ├── projects.test.ts
│       ├── issues.test.ts
│       ├── events.test.ts
│       ├── tokens.test.ts
│       ├── error-handling.test.ts
│       └── pagination.test.ts
│
└── dist/                  # Build output (ESM + CJS + DTS)
    ├── index.js           # ESM bundle
    ├── index.cjs          # CommonJS bundle
    └── index.d.ts         # TypeScript declarations
```

## Design Patterns

### 1. Schema-First with Zod

**Single Source of Truth**: Zod schemas define both runtime validation AND TypeScript types.

```typescript
// Schema (runtime validation)
export const projectSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slug: z.string(),
  sentry_key: z.string().uuid(),
  // ...
});

// Type (compile-time, inferred from schema)
export type Project = z.infer<typeof projectSchema>;
```

**Why Zod?**
- Runtime validation catches API contract breaking changes
- Single source of truth (schema → types)
- Type inference eliminates duplication
- Better error messages than plain TypeScript

### 2. Resource Pattern

Each API resource is a class extending `BaseResource`:

```typescript
export class ProjectsResource extends BaseResource {
  async list(): Promise<Project[]> {
    const data = await this.http.get('api/projects').json();
    return this.validate(data, z.array(projectSchema));
  }

  async get(id: number): Promise<Project> {
    const data = await this.http.get(`api/projects/${id}`).json();
    return this.validate(data, projectSchema);
  }

  // create, update, delete...
}
```

**Benefits:**
- Separation of concerns (one resource per API endpoint group)
- Shared validation logic via `BaseResource`
- Easy to test in isolation

### 3. Structured Error Handling

Custom error hierarchy for different failure scenarios:

```
RustrakError (base)
├── NetworkError (retryable: true)
├── AuthenticationError (401, retryable: false)
├── AuthorizationError (403, retryable: false)
├── NotFoundError (404, retryable: false)
├── BadRequestError (400, retryable: false)
├── RateLimitError (429, retryable: true, has retryAfter)
├── ServerError (500+, retryable: true)
└── ValidationError (schema mismatch, retryable: false)
```

**Usage:**
```typescript
try {
  await client.projects.list();
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Retry after ${error.retryAfter}s`);
  } else if (error instanceof AuthenticationError) {
    // Redirect to login
  }
}
```

### 4. HTTP Client Configuration (ky)

**Why ky over axios/fetch?**
- Smaller bundle size (3KB vs 6.7KB axios)
- TypeScript-native
- Built-in retry with exponential backoff
- Hooks for request/response transformation
- Modern, Promise-based API

**Configuration:**
```typescript
const instance = ky.create({
  prefixUrl: config.baseUrl,
  timeout: 30000,
  retry: {
    limit: 2,
    statusCodes: [408, 429, 500, 502, 503, 504],
  },
  hooks: {
    beforeRequest: [(req) => {
      req.headers.set('Authorization', `Bearer ${token}`);
    }],
    beforeError: [async (error) => {
      // Transform ky errors to RustrakError
      if (error.response?.status === 429) {
        throw new RateLimitError(...);
      }
    }],
  },
});
```

### 5. Cursor-Based Pagination

All list endpoints return paginated responses:

```typescript
interface PaginatedResponse<T> {
  items: T[];
  next_cursor?: string;
  has_more: boolean;
}

// Paginate through all issues
let cursor: string | undefined;
do {
  const { items, next_cursor, has_more } = await client.issues.list(projectId, { cursor });
  // Process items...
  cursor = next_cursor;
} while (cursor);
```

## API Reference

### Client Initialization

```typescript
import { RustrakClient } from '@rustrak/client';

const client = new RustrakClient({
  baseUrl: 'http://localhost:8080',
  token: 'your-bearer-token',
  timeout: 30000,      // Optional (default: 30000ms)
  maxRetries: 2,       // Optional (default: 2)
  headers: {},         // Optional custom headers
});
```

### Projects Resource

```typescript
// List all projects
const projects = await client.projects.list();

// Get single project
const project = await client.projects.get(1);

// Create project
const newProject = await client.projects.create({
  name: 'My App',
  slug: 'my-app',  // Optional
});

// Update project
const updated = await client.projects.update(1, { name: 'New Name' });

// Delete project
await client.projects.delete(1);
```

### Issues Resource

```typescript
// List issues with pagination and filters
const response = await client.issues.list(projectId, {
  sort: 'last_seen',           // 'digest_order' | 'last_seen'
  order: 'desc',               // 'asc' | 'desc'
  include_resolved: false,     // Include resolved issues
  cursor: 'eyJzb3J0...',       // Pagination cursor
});

// Get single issue
const issue = await client.issues.get(projectId, issueId);

// Update issue state (resolve/mute)
await client.issues.updateState(projectId, issueId, {
  is_resolved: true,
  is_muted: false,
});

// Delete issue
await client.issues.delete(projectId, issueId);
```

### Events Resource

```typescript
// List events for an issue
const { items, next_cursor } = await client.events.list(projectId, issueId, {
  order: 'desc',
  cursor: 'optional-cursor',
});

// Get event detail with full Sentry data
const event = await client.events.get(projectId, issueId, eventId);
console.log(event.data); // Full Sentry event JSON
```

### Auth Tokens Resource

```typescript
// List tokens (masked)
const tokens = await client.tokens.list();

// Create token (full token shown ONLY once)
const created = await client.tokens.create({
  description: 'CI/CD Token',
});
console.log(created.token); // SAVE THIS! Won't be shown again

// Delete token
await client.tokens.delete(tokenId);
```

## Usage Examples

### Next.js Server Component

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

### Next.js Client Component with SWR

```typescript
'use client';
import useSWR from 'swr';
import { RustrakClient } from '@rustrak/client';

const client = new RustrakClient({ /* ... */ });

export function IssuesList({ projectId }: { projectId: number }) {
  const { data, error } = useSWR(
    ['issues', projectId],
    () => client.issues.list(projectId)
  );

  if (error) return <div>Error: {error.message}</div>;
  if (!data) return <div>Loading...</div>;

  return <div>{/* render issues */}</div>;
}
```

### Error Handling

```typescript
import { RateLimitError, AuthenticationError } from '@rustrak/client';

try {
  await client.projects.list();
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof AuthenticationError) {
    redirect('/login');
  }
}
```

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

### Test Coverage (97.43%)

- **Unit Tests** (39 tests): Schemas, error classes
- **Integration Tests** (94 tests):
  - Client initialization
  - Projects CRUD
  - Issues pagination
  - Events listing
  - Tokens management
  - Error handling (all HTTP codes)
  - Retry logic
  - Edge cases (malformed responses, timeouts, etc.)

### MSW (Mock Service Worker)

All integration tests use MSW to mock HTTP requests:

```typescript
// tests/mocks/handlers.ts
export const handlers = [
  http.get('http://localhost:8080/api/projects', () => {
    return HttpResponse.json(mockProjects);
  }),
  // ...
];
```

**Benefits:**
- Tests run without real API server
- Deterministic responses
- Easy to test error scenarios

## Development

### Building

```bash
pnpm build
# Outputs: dist/index.js (ESM), dist/index.cjs (CJS), dist/index.d.ts
```

### Type Checking

```bash
pnpm check-types
```

### Adding a New Resource

1. **Create schema** in `src/schemas/`:
```typescript
export const newResourceSchema = z.object({
  id: z.number(),
  name: z.string(),
});
```

2. **Infer type** in `src/types/`:
```typescript
export type NewResource = z.infer<typeof newResourceSchema>;
```

3. **Create resource class** in `src/resources/`:
```typescript
export class NewResourceResource extends BaseResource {
  async list(): Promise<NewResource[]> {
    const data = await this.http.get('api/new-resources').json();
    return this.validate(data, z.array(newResourceSchema));
  }
}
```

4. **Add to client** in `src/client.ts`:
```typescript
export class RustrakClient {
  public readonly newResources: NewResourceResource;

  constructor(config: ClientConfig) {
    // ...
    this.newResources = new NewResourceResource(this.http);
  }
}
```

5. **Write tests** in `tests/integration/new-resource.test.ts`

## Performance Considerations

- **Bundle Size**: ~28KB total (ESM)
  - ky: 3KB
  - zod: 10KB
  - client code: 15KB

- **Retry Strategy**:
  - 2 retries by default
  - Exponential backoff
  - Only retries on: 408, 429, 500, 502, 503, 504
  - Does NOT retry on: 4xx (except 429)

- **Timeout**: 30 seconds default (configurable)

## Skills to Use

When working on this package:
- **typescript-strict** - Type-safe patterns, Zod usage
- **vercel-react-best-practices** - If integrating with Next.js

## References

- **Server API Spec**: `apps/server/CLAUDE.md`
- **ky Documentation**: https://github.com/sindresorhus/ky
- **Zod Documentation**: https://zod.dev
- **MSW Documentation**: https://mswjs.io
- **pnpm Workspaces**: https://pnpm.io/workspaces
