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
- ✅ **No exceptions**: every method returns a `Result<T, RustrakError>`
- ✅ Serializable errors, so a failure crosses React's server/client boundary
- ✅ Cursor- and offset-based pagination support
- ✅ 452 tests, 97% statement coverage

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

- **HTTP Client**: [ky](https://github.com/sindresorhus/ky) v2 (~3KB, TypeScript-native)
- **Validation**: [Zod](https://zod.dev) v4 (~10KB, runtime type safety)
- **Build Tool**: [tsup](https://tsup.egoist.dev) (esbuild-based, fast)
- **Testing**: [Vitest](https://vitest.dev) + [MSW](https://mswjs.io) (Mock Service Worker)
- **TypeScript**: strict mode, `noUncheckedIndexedAccess` on
- **Runtime**: Node >= 20 (the oldest LTS still receiving security patches; Node 18 reached end of life in April 2025)

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
│   ├── errors.ts          # The RustrakError union + isRetryable (no classes)
│   ├── result.ts          # Result<T, E>, Ok, Err, unwrap, unwrapOr, mapResult
│   │
│   ├── resources/         # API resource classes (21 of them)
│   │   ├── base.ts        # BaseResource: the ky -> Result boundary
│   │   ├── auth.ts        # AuthResource (login/register/logout/me)
│   │   ├── projects.ts    # ProjectsResource (CRUD)
│   │   ├── issues.ts      # IssuesResource (list, get, updateState, delete)
│   │   ├── events.ts      # EventsResource (list, get)
│   │   └── tokens.ts      # TokensResource (CRUD)
│   │
│   └── utils/
│       ├── http.ts        # createKyInstance, transformHttpError, the carrier
│       └── index.ts       # re-exports createKyInstance only
│
├── tests/
│   ├── setup.ts           # MSW server setup
│   ├── helpers/
│   │   └── result.ts      # expectOk / expectErr
│   ├── mocks/
│   │   └── handlers.ts    # MSW request handlers
│   │
│   ├── unit/
│   │   ├── schemas.test.ts
│   │   ├── user-schemas.test.ts
│   │   ├── errors.test.ts          # the union + isRetryable
│   │   ├── base-resource.test.ts   # the boundary paths MSW cannot reach
│   │   └── app-error-contract.test.ts  # parses apps/server/src/error.rs
│   │
│   └── integration/       # 22 files, one per resource plus
│       ├── client.test.ts
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
  async list(): Promise<Result<OffsetPaginatedResponse<Project>, RustrakError>> {
    return this.request(
      () => this.http.get('api/projects'),
      offsetPaginatedResponseSchema(projectSchema),
    );
  }

  async create(
    input: CreateProject,
  ): Promise<Result<Project, RustrakError>> {
    // Pre-flight: a bad input is `invalid_request` and never leaves the process.
    const validated = this.validateInput(input, createProjectSchema);
    if (!validated.success) return validated;

    return this.request(
      () => this.http.post('api/projects', { json: validated.data }),
      projectSchema,
    );
  }
}
```

Note what a resource method does **not** do: no `try`/`catch`, and no `.json()`
shortcut. It hands `BaseResource` a thunk that returns ky's `ResponsePromise`
and a schema. `BaseResource` owns the rest.

**Benefits:**
- Separation of concerns (one resource per API endpoint group)
- Shared validation logic via `BaseResource`
- One place decides what counts as an expected failure, for all 86 methods
- Easy to test in isolation

### 3. Errors: one closed union, returned not thrown

There are no error classes. Every resource method returns a
`Result<T, RustrakError>`, and `RustrakError` is a single discriminated union of
plain objects keyed on `kind`.

```typescript
type RustrakError =
  | { kind: 'validation';        status: number; message: string }  // 400
  | { kind: 'unauthenticated';   status: number; message: string }  // 401
  | { kind: 'forbidden';         status: number; message: string }  // 403
  | { kind: 'not_found';         status: number; message: string }  // 404
  | { kind: 'conflict';          status: number; message: string }  // 409
  | { kind: 'gone';              status: number; message: string }  // 410
  | { kind: 'payload_too_large'; status: number; message: string }  // 413
  | { kind: 'rate_limited';      status: number; message: string; retryAfter?: number }
  | { kind: 'client_error';      status: number; message: string }  // any other sub-500
  | { kind: 'server_error';      status: number; message: string; incidentId?: string }
  | { kind: 'invalid_request';   message: string }   // never sent
  | { kind: 'network';           message: string; reason: 'timeout' | 'unreachable' }
  | { kind: 'invalid_response';  message: string };  // 2xx, wrong body
```

**Why plain objects and not classes.** React's Flight serializer refuses
anything whose prototype is not `Object.prototype`. A class instance cannot be
returned from a Server Component or a Server Action, so a thrown
`NotFoundError` used to reach the browser as an opaque digest. A `Result`
survives `structuredClone`, which is what the suite asserts.

**Usage:**
```typescript
const projects = await client.projects.list();

if (!projects.success) {
  switch (projects.error.kind) {
    case 'unauthenticated':
      redirect('/auth/login');       // ONLY this kind means "log in again"
      break;
    case 'rate_limited':
      wait(projects.error.retryAfter ?? 30);
      break;
    default:
      return <LoadFailed error={projects.error} />;
  }
}

projects.data.items; // narrowed, no cast
```

Three things the union deliberately refuses to carry, because each embeds
information that must not cross a serialization boundary:

| Dropped | Why |
|---|---|
| the server's 5xx message | `AppError::Internal`/`Database` interpolate a pool error, an OS errno, a filesystem path. Replaced by `SERVER_ERROR_MESSAGE`. |
| `cause` on `network` | the underlying error's message is `...: GET http://rustrak.internal:8080/...`, the deployment's own host and port. Replaced by `NETWORK_ERROR_MESSAGE` / `TIMEOUT_ERROR_MESSAGE`; branch on `reason`. |
| Zod issues on `invalid_response` | they embed the offending response data. |

`isRetryable(error)` is the one function over the union; see the deferred-work
ledger for the known incoherence between it and ky's own retry policy.

`ApiError` is still exported, and it is **not** part of this: it types the flat
`{error, message?}` body as it appears on the wire, for code reading a Rustrak
response outside this client. Nothing in the client returns it.

### 4. HTTP Client Configuration (ky)

**Why ky over axios/fetch?**
- Smaller bundle size (3KB vs 6.7KB axios)
- TypeScript-native
- Built-in retry with exponential backoff
- Hooks for request/response transformation
- Modern, Promise-based API

**Configuration** (`src/utils/http.ts`):
```typescript
ky.create({
  prefix: config.baseUrl,
  timeout: config.timeout ?? 30000,
  credentials: 'include',
  retry: {
    limit: config.maxRetries ?? 2,
    statusCodes: [408, 500, 502, 503, 504],
    methods: ['get', 'post', 'put', 'patch', 'delete'],
  },
  headers: {
    // Required: `BaseResource` parses the body itself instead of calling ky's
    // `.json()` shortcut, and that shortcut was what used to set `Accept`.
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...config.headers,
  },
  hooks: {
    beforeError: [
      ({ error }) => {
        // ky signals a non-2xx by rejecting, and a rejection has to be caught
        // somewhere. The union is smuggled out inside `RustrakTransportFailure`
        // (a real Error subclass) and unwrapped by `BaseResource` into an
        // `Err`. It is never exported.
        throw new RustrakTransportFailure(transformHttpError(error));
      },
    ],
  },
});
```

`transformHttpError` is total: every 5xx redacts, every other unenumerated
status lands on `client_error`, so no status is unrepresentable.

### 5. Pagination

Two shapes, both wrapped in a `Result`:

```typescript
// Cursor-based (events, spans, logs)
interface PaginatedResponse<T> {
  items: T[];
  next_cursor?: string;
  has_more: boolean;
}

// Offset-based (projects, issues, and most list endpoints)
interface OffsetPaginatedResponse<T> {
  items: T[];
  total_count: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Paginate through every event of an issue
let cursor: string | undefined;
do {
  const page = await client.events.list(projectId, issueId, { cursor });
  if (!page.success) break;          // a failed page is not an empty page
  process(page.data.items);
  cursor = page.data.next_cursor;
} while (cursor);
```

The `if (!page.success) break` is the point of the whole API: stopping on a
failure is a decision the caller has to make, and it now cannot be skipped by
accident.

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

Every method returns `Promise<Result<T, RustrakError>>`. `T` is named below.

```typescript
await client.projects.list();          // OffsetPaginatedResponse<Project>
await client.projects.get(1);          // Project
await client.projects.create({ name: 'My App', slug: 'my-app' }); // Project
await client.projects.update(1, { name: 'New Name' });            // Project
await client.projects.delete(1);       // void

// Reading one:
const project = await client.projects.get(1);
if (project.success) console.log(project.data.dsn);
```

### Issues Resource

```typescript
await client.issues.list(projectId, {
  sort: 'last_seen',        // 'digest_order' | 'last_seen' | 'event_count'
  order: 'desc',            // 'asc' | 'desc'
  filter: 'open',           // 'open' | 'resolved' | 'muted' | 'all'
  page: 1,
  per_page: 20,
  q: 'TypeError',           // free-text search
});                                            // OffsetPaginatedResponse<Issue>

await client.issues.get(projectId, issueId);   // Issue
await client.issues.updateState(projectId, issueId, {
  is_resolved: true,
  is_muted: false,
});                                            // Issue
await client.issues.delete(projectId, issueId); // void
```

### Events Resource

```typescript
await client.events.list(projectId, issueId, { order: 'desc', cursor });
// PaginatedResponse<Event>, cursor-based

const event = await client.events.get(projectId, issueId, eventId); // EventDetail
if (event.success) console.log(event.data.data); // full Sentry event JSON
```

### Auth Tokens Resource

```typescript
await client.tokens.list();     // AuthToken[] (masked)

// Create: the full token is returned ONCE and never again.
const created = await client.tokens.create({ description: 'CI/CD Token' });
if (created.success) save(created.data.token);

await client.tokens.delete(tokenId); // void
```

## Usage Examples

### Next.js Server Component

```typescript
import { RustrakClient } from '@rustrak/client';
import { redirect } from 'next/navigation';

export default async function ProjectsPage() {
  const client = new RustrakClient({
    baseUrl: process.env.RUSTRAK_API_URL!,
    token: process.env.RUSTRAK_API_TOKEN!,
  });

  const projects = await client.projects.list();

  if (!projects.success) {
    // `kind` decides. Redirecting on 'network' or 'server_error' turns a flaky
    // connection into a login loop, which is the bug this API exists to expose.
    if (projects.error.kind === 'unauthenticated') redirect('/auth/login');
    return <LoadFailed error={projects.error} />;
  }

  return <ProjectsList projects={projects.data.items} />;
}
```

### Server Action

```typescript
'use server';

export async function resolveIssue(projectId: number, issueId: string) {
  // Returned as-is. A `Result` is serializable, so the client component gets
  // the actual failure rather than an opaque "An error occurred" digest.
  return client.issues.updateState(projectId, issueId, { is_resolved: true });
}
```

### Next.js Client Component with SWR

```typescript
'use client';
import useSWR from 'swr';

export function IssuesList({ projectId }: { projectId: number }) {
  // The fetcher never rejects, so SWR's `error` stays empty: the failure is in
  // `data`. Unwrap it in the fetcher if you want SWR's retry behaviour.
  const { data } = useSWR(['issues', projectId], () =>
    client.issues.list(projectId),
  );

  if (!data) return <Spinner />;
  if (!data.success) return <LoadFailed error={data.error} />;

  return <List items={data.data.items} />;
}
```

### Error Handling

```typescript
import { isRetryable, type RustrakError } from '@rustrak/client';

const result = await client.projects.list();

if (!result.success) {
  switch (result.error.kind) {
    case 'unauthenticated':
      redirect('/auth/login');
      break;
    case 'rate_limited':
      console.log(`Retry after ${result.error.retryAfter ?? 30}s`);
      break;
    case 'network':
      // `reason` is the field to branch on. `message` is a fixed string by
      // design: the underlying one names the host and port.
      console.log(result.error.reason); // 'timeout' | 'unreachable'
      break;
    default:
      if (isRetryable(result.error)) scheduleRetry();
  }
}
```

**Do not** reach for `unwrapOr(result, [])` to make a page compile.
`unwrapOr(await client.projects.list(), [])` renders the same empty state for
"no projects" and "the server is down", which is exactly the regression this
API exists to prevent.

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

### Test Coverage (452 tests, 97% statements)

- **Unit tests**: Zod schemas, the `RustrakError` union and `isRetryable`, the
  `BaseResource` boundary paths no MSW fixture can reach (a body read that
  rejects, a body that must be cancelled), and `app-error-contract.test.ts`,
  which parses `apps/server/src/error.rs` and fails if a `#[error(...)]` string
  or a `StatusCode` drifts away from the fixtures.
- **Integration tests**: one file per resource, driven through the real client
  against MSW, plus `error-handling.test.ts` (every status -> `kind`, the
  redactions, retry, `structuredClone` across the RSC boundary) and
  `pagination.test.ts`.

Two rules this suite is written to:

1. **Assert on what the client produced, not on a literal you just wrote.** A
   test that builds an object literal and asserts its shape cannot fail; it is
   documentation wearing a test's clothes. Use `expectOk` / `expectErr` from
   `tests/helpers/result.ts` on a real call.
2. **`expectErr` alone is not an assertion.** It only establishes
   `success === false`. Every call site must also pin `kind`, because "it failed
   somehow" is strictly weaker than the `instanceof` check it replaced.

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
  async list(): Promise<Result<NewResource[], RustrakError>> {
    return this.request(
      () => this.http.get('api/new-resources'),
      z.array(newResourceSchema),
    );
  }

  async create(
    input: CreateNewResource,
  ): Promise<Result<NewResource, RustrakError>> {
    const validated = this.validateInput(input, createNewResourceSchema);
    if (!validated.success) return validated;

    return this.request(
      () => this.http.post('api/new-resources', { json: validated.data }),
      newResourceSchema,
    );
  }

  async delete(id: number): Promise<Result<void, RustrakError>> {
    // `requestVoid`, not `request`: it also releases the response body, which
    // otherwise holds its socket out of Node's keep-alive pool.
    return this.requestVoid(() => this.http.delete(`api/new-resources/${id}`));
  }
}
```

Never write a `try`/`catch` in a resource, and never call ky's `.json()`
shortcut. Both belong to `BaseResource`: it is the single boundary where a
rejected ky promise becomes an `Err`, and putting a second one in a resource
means one of the 86 methods will disagree with the other 85.

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

- **Retry Strategy** (ky's, configured in `createKyInstance`):
  - 2 retries by default (`maxRetries`)
  - Exponential backoff
  - Retries on: 408, 500, 502, 503, 504
  - Retries `post`, `patch` and `delete` as well as `get` and `put`, which is
    **not** ky's default and is a known data-integrity risk on a write that the
    server committed before the gateway timed out. Recorded in
    `_bmad-output/implementation-artifacts/deferred-work.md`; read that entry
    before touching `retry`, together with the note on `isRetryable`
    disagreeing with this policy.

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
