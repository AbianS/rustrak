---
name: typescript-api-client
description: TypeScript REST API client patterns using Zod for validation, ky for HTTP, and resource-based architecture. Use when building API clients, implementing HTTP wrappers, or working with runtime type validation. Covers schema-first design, error handling, pagination, and retry logic.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Task
scope: packages/client/**
---

# TypeScript API Client Patterns

## Overview

This skill documents proven patterns for building type-safe, production-ready TypeScript clients for REST APIs. Based on the implementation of `@rustrak/client`, these patterns prioritize:

- **Type Safety**: Compile-time AND runtime validation
- **Developer Experience**: Autocomplete, clear errors, intuitive API
- **Robustness**: Structured errors, automatic retries, validation
- **Maintainability**: Single source of truth, separation of concerns

## Architecture Pattern

Use a **Resource-Based Architecture** where each API endpoint group becomes a class:

```
RustrakClient (main class)
├── projects: ProjectsResource
├── issues: IssuesResource
├── events: EventsResource
└── tokens: TokensResource
```

Each resource extends `BaseResource` and has access to:
- `this.http` - Configured HTTP client (ky)
- `this.validate()` - Schema validation helper

## Core Patterns

### 1. Schema-First with Zod

**ALWAYS define Zod schemas first, then infer TypeScript types.**

```typescript
// ✅ CORRECT: Schema is source of truth
// schemas/project.ts
export const projectSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slug: z.string(),
  created_at: z.string().datetime(),
});

// types/project.ts
export type Project = z.infer<typeof projectSchema>;
```

```typescript
// ❌ WRONG: Duplicating type definitions
export interface Project {
  id: number;
  name: string;
  slug: string;
  created_at: string;
}
```

**Why this matters:**
- Single source of truth (no duplication)
- Runtime validation catches API breaking changes
- Type inference eliminates manual updates
- Better error messages on schema mismatch

**Schema Organization:**
```
src/
├── schemas/          # Zod schemas (runtime validation)
│   ├── common.ts     # Shared schemas (pagination, etc.)
│   ├── project.ts
│   └── issue.ts
└── types/            # TypeScript types (inferred)
    ├── common.ts     # export type Foo = z.infer<typeof fooSchema>
    ├── project.ts
    └── issue.ts
```

### 2. BaseResource Pattern

Create a base class with shared validation logic:

```typescript
// resources/base.ts
export abstract class BaseResource {
  protected readonly http: KyInstance;

  constructor(http: KyInstance) {
    this.http = http;
  }

  protected validate<T>(data: unknown, schema: ZodSchema<T>): T {
    const result = schema.safeParse(data);

    if (!result.success) {
      throw new ValidationError('API response validation failed', result.error);
    }

    return result.data;
  }
}
```

**Each resource extends this:**

```typescript
// resources/projects.ts
export class ProjectsResource extends BaseResource {
  async list(): Promise<Project[]> {
    const data = await this.http.get('api/projects').json();
    return this.validate(data, z.array(projectSchema));
  }

  async get(id: number): Promise<Project> {
    const data = await this.http.get(`api/projects/${id}`).json();
    return this.validate(data, projectSchema);
  }

  async create(input: CreateProject): Promise<Project> {
    // Validate INPUT before sending
    const validatedInput = this.validate(input, createProjectSchema);

    const data = await this.http
      .post('api/projects', { json: validatedInput })
      .json();

    // Validate RESPONSE after receiving
    return this.validate(data, projectSchema);
  }
}
```

**Why this matters:**
- Separation of concerns (one resource per API group)
- Shared validation logic (DRY)
- Easy to test in isolation
- Clear responsibility boundaries

### 3. Structured Error Hierarchy

Create a custom error hierarchy with `retryable` flags:

```typescript
// errors/base.ts
export class RustrakError extends Error {
  public readonly retryable: boolean;
  public readonly statusCode?: number;
  public readonly cause?: Error;

  constructor(message: string, options?: {
    retryable?: boolean;
    statusCode?: number;
    cause?: Error;
  }) {
    super(message);
    this.name = this.constructor.name;
    this.retryable = options?.retryable ?? false;
    this.statusCode = options?.statusCode;
    this.cause = options?.cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
```

**Specific error types:**

```typescript
// errors/http.ts
export class NetworkError extends RustrakError {
  constructor(message: string, cause?: Error) {
    super(message, { retryable: true, cause });
  }
}

export class AuthenticationError extends RustrakError {
  constructor(message = 'Authentication failed') {
    super(message, { retryable: false, statusCode: 401 });
  }
}

export class RateLimitError extends RustrakError {
  public readonly retryAfter?: number;

  constructor(message = 'Rate limit exceeded', retryAfter?: string | number) {
    super(message, { retryable: true, statusCode: 429 });
    if (retryAfter !== undefined) {
      this.retryAfter = typeof retryAfter === 'string'
        ? parseInt(retryAfter, 10)
        : retryAfter;
    }
  }
}
```

**Error hierarchy:**
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

**Usage pattern:**

```typescript
try {
  await client.projects.list();
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Retry after ${error.retryAfter}s`);
    // Wait and retry
  } else if (error instanceof AuthenticationError) {
    // Redirect to login
  } else if (error.retryable) {
    // Generic retry logic
  }
}
```

### 4. HTTP Client Setup with ky

**Why ky over axios/fetch:**
- Smaller (3KB vs 6.7KB axios)
- TypeScript-native
- Built-in retry with exponential backoff
- Hooks for transformation
- Modern Promise-based API

```typescript
// utils/http.ts
import ky, { type KyInstance, type HTTPError } from 'ky';

export function createKyInstance(config: ClientConfig): KyInstance {
  return ky.create({
    prefixUrl: config.baseUrl,
    timeout: config.timeout ?? 30000,
    retry: {
      limit: config.maxRetries ?? 2,
      statusCodes: [408, 429, 500, 502, 503, 504],
      methods: ['get', 'post', 'put', 'patch', 'delete'],
    },
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.token}`,
      ...config.headers,
    },
    hooks: {
      beforeError: [
        async (error) => {
          // Transform ky errors to custom errors
          if (error.name === 'TimeoutError') {
            throw new NetworkError('Request timed out', error);
          }

          if (error.response) {
            const status = error.response.status;
            let errorMessage = `HTTP ${status} error`;

            try {
              const body = await error.response.json();
              errorMessage = body.error || body.message || errorMessage;
            } catch {}

            switch (status) {
              case 401:
                throw new AuthenticationError(errorMessage);
              case 404:
                throw new NotFoundError(errorMessage);
              case 429:
                const retryAfter = error.response.headers.get('Retry-After');
                throw new RateLimitError(errorMessage, retryAfter ?? undefined);
              case 500:
              case 502:
              case 503:
              case 504:
                throw new ServerError(errorMessage, status);
              default:
                throw new RustrakError(errorMessage, { statusCode: status });
            }
          }

          throw new NetworkError(error.message, error);
        },
      ],
    },
  });
}
```

**Key points:**
- Configure retry for server errors only (not 4xx)
- Transform errors in `beforeError` hook
- Extract error messages from response body
- Set default headers (Authorization, Content-Type)

### 5. Cursor-Based Pagination

**Schema pattern:**

```typescript
// schemas/common.ts
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T
) =>
  z.object({
    items: z.array(itemSchema),
    next_cursor: z.string().optional(),
    has_more: z.boolean(),
  });

// types/common.ts
export interface PaginatedResponse<T> {
  items: T[];
  next_cursor?: string;
  has_more: boolean;
}
```

**Resource implementation:**

```typescript
async list(
  projectId: number,
  options?: { cursor?: string }
): Promise<PaginatedResponse<Issue>> {
  const searchParams: Record<string, string> = {};

  if (options?.cursor) {
    searchParams.cursor = options.cursor;
  }

  const data = await this.http
    .get(`api/projects/${projectId}/issues`, { searchParams })
    .json();

  return this.validate(data, paginatedResponseSchema(issueSchema));
}
```

**Consumer pattern:**

```typescript
// Paginate through all items
const allIssues = [];
let cursor: string | undefined;

do {
  const { items, next_cursor, has_more } = await client.issues.list(1, { cursor });
  allIssues.push(...items);
  cursor = next_cursor;
} while (cursor);
```

### 6. Main Client Class

**Composition pattern:**

```typescript
// client.ts
export class RustrakClient {
  private readonly http: KyInstance;

  public readonly projects: ProjectsResource;
  public readonly issues: IssuesResource;
  public readonly events: EventsResource;
  public readonly tokens: TokensResource;

  constructor(config: ClientConfig) {
    this.http = createKyInstance(config);

    // Initialize all resources
    this.projects = new ProjectsResource(this.http);
    this.issues = new IssuesResource(this.http);
    this.events = new EventsResource(this.http);
    this.tokens = new TokensResource(this.http);
  }
}
```

**Usage:**

```typescript
const client = new RustrakClient({
  baseUrl: 'http://localhost:8080',
  token: 'your-token',
});

await client.projects.list();
await client.issues.get(1, 'issue-id');
```

## Testing with MSW

Use Mock Service Worker for HTTP mocking:

```typescript
// tests/setup.ts
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers.js';

export const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
```

**Mock handlers:**

```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('http://localhost:8080/api/projects', () => {
    return HttpResponse.json(mockProjects);
  }),

  http.get('http://localhost:8080/api/projects/:id', ({ params }) => {
    const project = mockProjects.find(p => p.id === Number(params.id));
    if (!project) {
      return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return HttpResponse.json(project);
  }),
];
```

**Integration tests:**

```typescript
describe('ProjectsResource', () => {
  let client: RustrakClient;

  beforeEach(() => {
    client = new RustrakClient({
      baseUrl: 'http://localhost:8080',
      token: 'test-token',
    });
  });

  it('should fetch all projects', async () => {
    const projects = await client.projects.list();
    expect(projects).toHaveLength(2);
  });

  it('should throw NotFoundError for non-existent project', async () => {
    await expect(client.projects.get(999)).rejects.toThrow(NotFoundError);
  });

  it('should validate response schema', async () => {
    server.use(
      http.get('http://localhost:8080/api/projects', () => {
        return HttpResponse.json([{ id: 'invalid' }]); // Wrong type
      })
    );

    await expect(client.projects.list()).rejects.toThrow(ValidationError);
  });
});
```

## Common Pitfalls

### 1. Duplicating Types and Schemas

**❌ Wrong:**
```typescript
// Defining both manually
export interface Project { ... }
export const projectSchema = z.object({ ... });
```

**✅ Correct:**
```typescript
// Schema first, type inferred
export const projectSchema = z.object({ ... });
export type Project = z.infer<typeof projectSchema>;
```

### 2. Not Validating Input

**❌ Wrong:**
```typescript
async create(input: CreateProject): Promise<Project> {
  // Sending without validation
  const data = await this.http.post('api/projects', { json: input }).json();
  return this.validate(data, projectSchema);
}
```

**✅ Correct:**
```typescript
async create(input: CreateProject): Promise<Project> {
  // Validate input BEFORE sending
  const validatedInput = this.validate(input, createProjectSchema);
  const data = await this.http.post('api/projects', { json: validatedInput }).json();
  return this.validate(data, projectSchema);
}
```

### 3. Retrying Non-Retryable Errors

**❌ Wrong:**
```typescript
retry: {
  statusCodes: [400, 401, 404, 500], // Don't retry 4xx!
}
```

**✅ Correct:**
```typescript
retry: {
  statusCodes: [408, 429, 500, 502, 503, 504], // Only retry server errors
}
```

**Why:** 4xx errors are client errors (bad request, auth failed, not found). Retrying won't help.

### 4. Not Using Optional Chaining with Zod .optional()

**❌ Wrong:**
```typescript
// Schema
const schema = z.object({
  cursor: z.string().optional(),
});

// Usage
if (response.cursor) {
  // TypeScript error: cursor might be undefined
  searchParams.cursor = response.cursor;
}
```

**✅ Correct:**
```typescript
if (response.cursor !== undefined) {
  searchParams.cursor = response.cursor;
}

// Or use optional chaining
searchParams.cursor = response.cursor ?? 'default';
```

### 5. Creating Zod Errors Manually in Tests

**❌ Wrong (Zod v4):**
```typescript
const zodError = new ZodError([
  {
    code: 'invalid_type',
    expected: 'string',
    received: 'number', // This property doesn't exist in Zod v4
    path: ['name'],
    message: 'Expected string',
  },
]);
```

**✅ Correct:**
```typescript
// Use real schema validation to create errors
const schema = z.object({ name: z.string() });
const result = schema.safeParse({ name: 123 });

if (!result.success) {
  const error = new ValidationError('Validation failed', result.error);
  // Now error.validationErrors is a real ZodError
}
```

### 6. Not Handling has_more in Pagination

**❌ Wrong:**
```typescript
// Infinite loop if next_cursor is always present
while (next_cursor) {
  const { items, next_cursor } = await client.issues.list(1, { cursor });
  // ...
}
```

**✅ Correct:**
```typescript
// Use has_more as primary condition
do {
  const { items, next_cursor, has_more } = await client.issues.list(1, { cursor });
  cursor = next_cursor;
} while (cursor); // cursor is undefined when has_more is false
```

## Key Files Reference

| File | Purpose |
|------|---------|
| `packages/client/src/client.ts` | Main client class |
| `packages/client/src/config.ts` | ClientConfig interface |
| `packages/client/src/utils/http.ts` | ky setup with hooks |
| `packages/client/src/resources/base.ts` | BaseResource with validate() |
| `packages/client/src/resources/projects.ts` | Example resource implementation |
| `packages/client/src/schemas/common.ts` | Shared schemas (pagination) |
| `packages/client/src/errors/base.ts` | Base error class |
| `packages/client/src/errors/http.ts` | HTTP error classes |
| `packages/client/tests/setup.ts` | MSW setup |
| `packages/client/tests/mocks/handlers.ts` | MSW handlers |

## Build Configuration

**tsup.config.ts** (ESM + CJS + DTS):
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  treeshake: true,
  outDir: 'dist',
});
```

**package.json exports:**
```json
{
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  }
}
```

## Quick Reference

**Adding a new resource:**

1. Create schema: `schemas/resource.ts`
2. Infer types: `types/resource.ts`
3. Create resource class: `resources/resource.ts` extends `BaseResource`
4. Add to client: Update `client.ts` constructor
5. Write tests: `tests/integration/resource.test.ts`

**Schema patterns:**
```typescript
// String with format validation
z.string().uuid()
z.string().datetime()
z.string().email()

// Numbers
z.number().int()
z.number().positive()

// Optional/Nullable
z.string().optional()     // string | undefined
z.string().nullable()     // string | null
z.string().nullish()      // string | null | undefined

// Arrays
z.array(itemSchema)

// Enums
z.enum(['asc', 'desc'])

// Records/Objects
z.record(z.string(), z.any())
z.object({ key: z.string() })
```

**Error handling checklist:**
- [ ] Custom error extends `RustrakError`
- [ ] Set `retryable` flag correctly
- [ ] Include `statusCode` for HTTP errors
- [ ] Transform in `beforeError` hook
- [ ] Export from `errors/index.ts`
