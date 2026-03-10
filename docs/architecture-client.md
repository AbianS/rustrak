# Rustrak Client Package — Architecture

> **Package**: `@rustrak/client`
> **Location**: `packages/client`
> **Language**: TypeScript 5.9 strict mode

---

## 1. Overview

`@rustrak/client` is the official TypeScript HTTP client for the Rustrak API. It is used internally by `apps/webview-ui` (via Server Actions) and is also distributed as a public package for anyone building integrations against the Rustrak Management API.

Design goals:

- **Type-safe**: Every request parameter and response shape is validated at both compile time (TypeScript types) and runtime (Zod schemas)
- **Lightweight**: Total bundle is ~28KB (ky 3KB + zod 10KB + client 15KB)
- **Reliable**: Built-in retry with exponential backoff for transient failures
- **Simple**: One `RustrakClient` instance, resource sub-objects, no config maze

---

## 2. Architecture Pattern

### Schema-First

The source of truth for every data shape is a Zod schema. TypeScript types are **inferred** from those schemas — never written by hand. This eliminates the common drift between "what TypeScript thinks the type is" and "what the API actually returns."

```typescript
// Define schema (source of truth)
const IssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['unresolved', 'resolved', 'ignored']),
  count: z.number().int(),
  firstSeen: z.string().datetime(),
  lastSeen: z.string().datetime(),
  fingerprint: z.string(),
})

// Infer TypeScript type — never manually written
export type Issue = z.infer<typeof IssueSchema>
```

Every API response is parsed through its schema before being returned to the caller. If the server returns an unexpected shape, a `ValidationError` is thrown immediately with details about which field failed, rather than silently propagating a bad value.

### Resource Pattern

API endpoints are organized into resource classes that mirror the REST URL hierarchy:

```
RustrakClient
  ├── .projects     → ProjectsResource
  ├── .issues       → IssuesResource
  ├── .events       → EventsResource
  └── .tokens       → TokensResource
```

Each resource encapsulates the HTTP calls for its domain. Callers never construct URLs or touch the HTTP layer directly.

---

## 3. Tech Stack

| Concern          | Technology         | Notes                                                  |
|------------------|--------------------|--------------------------------------------------------|
| Language         | TypeScript 5.9     | `strict: true`, `noUncheckedIndexedAccess: true`       |
| HTTP client      | ky 1.14            | ~3KB, fetch-based, TypeScript-native, retry built-in   |
| Validation       | Zod 4+             | ~10KB, runtime schema validation                       |
| Build            | tsup               | esbuild-based, ESM + CJS + DTS in one command          |
| Tests            | Vitest             | Fast, ESM-native test runner                           |
| API mocking      | MSW (Mock Service Worker) | Intercepts fetch at network layer, realistic mocks |
| Coverage         | @vitest/coverage-v8 | 97% coverage across 133 tests                         |

---

## 4. Resource API Reference

### ProjectsResource

```typescript
client.projects.list(options?: { cursor?: string; limit?: number })
  → Promise<PaginatedResponse<Project>>

client.projects.get(projectId: string)
  → Promise<Project>

client.projects.create(data: CreateProjectInput)
  → Promise<Project>

client.projects.update(projectId: string, data: UpdateProjectInput)
  → Promise<Project>

client.projects.delete(projectId: string)
  → Promise<void>
```

### IssuesResource

```typescript
client.issues.list(projectId: string, options?: {
  cursor?: string
  limit?: number
  status?: 'unresolved' | 'resolved' | 'ignored'
  tag?: string
})
  → Promise<PaginatedResponse<Issue>>

client.issues.get(issueId: string)
  → Promise<Issue>

client.issues.update(issueId: string, data: { status: IssueStatus })
  → Promise<Issue>

client.issues.delete(issueId: string)
  → Promise<void>
```

### EventsResource

```typescript
client.events.list(issueId: string, options?: { cursor?: string; limit?: number })
  → Promise<PaginatedResponse<Event>>

client.events.get(issueId: string, eventId: string)
  → Promise<Event>

client.events.latest(issueId: string)
  → Promise<Event>
```

### TokensResource

```typescript
client.tokens.list()
  → Promise<Token[]>

client.tokens.create(data: { name: string; expiresAt?: string })
  → Promise<TokenWithSecret>   // secret only returned on creation

client.tokens.revoke(tokenId: string)
  → Promise<void>
```

### Auth Helpers

```typescript
client.auth.login(data: { email: string; password: string })
  → Promise<User>

client.auth.logout()
  → Promise<void>

client.auth.me()
  → Promise<User>
```

---

## 5. Error Handling

All errors thrown by the client extend `RustrakError`. Callers can use `instanceof` checks or the `error.code` string to handle specific cases.

### Error Hierarchy

```
RustrakError (base)
  ├── NetworkError          — fetch failed, DNS error, timeout
  ├── AuthenticationError   — 401 Unauthorized
  ├── NotFoundError         — 404 Not Found
  ├── RateLimitError        — 429 Too Many Requests (includes retryAfter: number)
  ├── ServerError           — 5xx responses (after retries exhausted)
  └── ValidationError       — Zod parse failure on response body
```

### Usage

```typescript
import {
  RustrakClient,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
} from '@rustrak/client'

try {
  const issue = await client.issues.get('nonexistent-id')
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log('Issue does not exist')
  } else if (err instanceof AuthenticationError) {
    redirect('/auth/login')
  } else if (err instanceof RateLimitError) {
    console.log(`Retry after ${err.retryAfter} seconds`)
  } else {
    throw err  // Re-throw unexpected errors
  }
}
```

### ValidationError Details

When a response fails Zod validation, `ValidationError` includes the full Zod error:

```typescript
import { ValidationError } from '@rustrak/client'

try {
  await client.projects.get(id)
} catch (err) {
  if (err instanceof ValidationError) {
    console.error('Unexpected response shape:', err.zodError.format())
  }
}
```

---

## 6. Retry and Timeout Configuration

### Defaults

| Setting     | Default | Description                                      |
|-------------|---------|--------------------------------------------------|
| Retries     | 2       | Maximum retry attempts after initial failure     |
| Backoff     | Exponential (100ms, 200ms) | Delay between retries               |
| Timeout     | 30,000ms | Per-request timeout                             |
| Retry on    | 408, 429, 5xx | Status codes that trigger retry             |

### Custom Configuration

```typescript
const client = new RustrakClient({
  baseUrl: 'https://tracking.example.com',
  timeout: 10_000,           // 10 second timeout
  retry: {
    limit: 3,
    methods: ['get'],        // Only retry GET requests
    statusCodes: [429, 503],
  },
  headers: {
    Authorization: `Bearer ${token}`,
  },
})
```

### Disabling Retry

```typescript
const client = new RustrakClient({
  baseUrl: '...',
  retry: { limit: 0 },     // No retries
})
```

---

## 7. Pagination

All list methods return a `PaginatedResponse<T>`:

```typescript
type PaginatedResponse<T> = {
  data: T[]
  nextCursor: string | null   // null means no more pages
  prevCursor: string | null
}
```

### Iterating All Pages

```typescript
let cursor: string | undefined
const allIssues: Issue[] = []

do {
  const page = await client.issues.list(projectId, { cursor, limit: 100 })
  allIssues.push(...page.data)
  cursor = page.nextCursor ?? undefined
} while (cursor)
```

The cursor is an opaque string (base64-encoded keyset values). Do not attempt to parse or construct cursors manually.

---

## 8. Testing Strategy

### MSW (Mock Service Worker)

Tests use MSW to intercept HTTP requests at the `fetch` layer. This means:

- The actual `ky` HTTP client code runs in tests
- No mocking of internal functions — the full client stack is exercised
- Network behavior (timeouts, retries) is testable by configuring the MSW handler

### Test Structure

```
packages/client/tests/
├── setup.ts                  # MSW server setup, global beforeAll/afterEach
├── fixtures/
│   ├── projects.ts           # Realistic mock project data
│   ├── issues.ts             # Realistic mock issue data
│   └── events.ts             # Realistic mock event data
├── resources/
│   ├── projects.test.ts      # ProjectsResource tests
│   ├── issues.test.ts        # IssuesResource tests
│   ├── events.test.ts        # EventsResource tests
│   └── tokens.test.ts        # TokensResource tests
├── errors.test.ts            # Error hierarchy, 4xx/5xx handling
├── retry.test.ts             # Retry logic (3 attempts, backoff, status codes)
├── pagination.test.ts        # Cursor pagination behavior
└── validation.test.ts        # Zod schema validation (malformed responses)
```

### Coverage Requirements

The project enforces a minimum coverage threshold in `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    lines: 95,
    branches: 90,
    functions: 95,
    statements: 95,
  },
}
```

Current coverage: **97%** across **133 tests**.

---

## 9. Build Output

tsup produces three output formats from a single build command:

```
packages/client/dist/
├── index.js        # ESM — for bundlers (Webpack, Vite, esbuild)
├── index.cjs       # CommonJS — for Node.js require()
└── index.d.ts      # TypeScript declaration file
```

### tsup Configuration

```typescript
// tsup.config.ts
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: false,   // Consumers' bundlers handle minification
})
```

### Package Exports

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  }
}
```

### Bundle Size Breakdown

| Module    | Size    |
|-----------|---------|
| ky        | ~3 KB   |
| zod       | ~10 KB  |
| client    | ~15 KB  |
| **Total** | **~28 KB** |

---

## 10. Adding New Resources

Follow these steps to add a new resource (e.g., `CommentsResource`).

### Step 1: Define Zod schemas

Create `src/schemas/comments.ts`:

```typescript
import { z } from 'zod'

export const CommentSchema = z.object({
  id: z.string(),
  body: z.string(),
  createdAt: z.string().datetime(),
  authorId: z.string(),
})

export type Comment = z.infer<typeof CommentSchema>

export const CreateCommentSchema = z.object({
  body: z.string().min(1).max(10_000),
})

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>
```

### Step 2: Implement the resource class

Create `src/resources/comments.ts`:

```typescript
import type { KyInstance } from 'ky'
import { CommentSchema, CreateCommentSchema } from '../schemas/comments'
import type { Comment, CreateCommentInput } from '../schemas/comments'
import { parseResponse } from '../utils/parse'

export class CommentsResource {
  constructor(private readonly ky: KyInstance) {}

  async list(issueId: string): Promise<Comment[]> {
    const json = await this.ky.get(`issues/${issueId}/comments`).json()
    return parseResponse(z.array(CommentSchema), json)
  }

  async create(issueId: string, data: CreateCommentInput): Promise<Comment> {
    const validated = CreateCommentSchema.parse(data)
    const json = await this.ky
      .post(`issues/${issueId}/comments`, { json: validated })
      .json()
    return parseResponse(CommentSchema, json)
  }
}
```

### Step 3: Register on the client

In `src/client.ts`, add the resource:

```typescript
import { CommentsResource } from './resources/comments'

export class RustrakClient {
  readonly comments: CommentsResource
  // ...existing resources

  constructor(config: RustrakClientConfig) {
    // ...existing setup
    this.comments = new CommentsResource(this.ky)
  }
}
```

### Step 4: Export from package index

In `src/index.ts`, add new types and classes to the public surface:

```typescript
export type { Comment, CreateCommentInput } from './schemas/comments'
```

### Step 5: Write tests

Create `tests/resources/comments.test.ts` with MSW handlers for the new endpoints. Test the happy path, 404, 401, validation failure, and pagination if applicable.

### Step 6: Build and verify

```bash
cd packages/client
pnpm build
pnpm test
pnpm test --coverage
```

Ensure coverage thresholds are still met before opening a PR.
