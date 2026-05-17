---
title: 'Rustrak MCP Server Package'
type: 'feature'
created: '2026-05-17'
status: 'in-review'
baseline_commit: '7fd41b8669b24e57582673c4502c52662482b085'
context:
  - '_bmad-output/project-context.md'
  - '.claude/skills/tdd/SKILL.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** There is no way for an AI (Claude Desktop, Cursor, etc.) to manage Rustrak errors directly — the dashboard must be opened manually to view issues, resolve them, or create projects.

**Approach:** Create the `packages/mcp` package (`@rustrak/mcp`) — a TypeScript MCP server that wraps `@rustrak/client` and exposes ~18 tools so AI can list projects, inspect issues, view events, resolve errors, and manage tokens, all via stdio transport.

## Boundaries & Constraints

**Always:**
- Implement with strict TDD using the `.claude/skills/tdd` skill: write the test first (red), then the minimum code to pass (green), then refactor. Never write implementation code without a failing test first.
- Vitest must be fully configured in `packages/mcp/vitest.config.ts` with ESM support (`pool: 'forks'` or equivalent for Node ESM), and tests must run with `pnpm test` from the package before writing any implementation.
- Transport: stdio only (this phase). `console.log` FORBIDDEN — corrupts JSON-RPC. Use only `console.error`.
- Auth: `RUSTRAK_API_URL` + `RUSTRAK_API_TOKEN` from env vars. Never as tool arguments. Fail at startup if missing.
- Errors: return `{ isError: true, content }` — do NOT throw. The LLM must be able to see and handle the error.
- Zod: the SDK accepts Standard Schema (v1.10+). Use `zod` v4 from the workspace (same version as the rest of the project). Do NOT install Zod v3.
- Build: tsup with ESM output. `"type": "module"` in package.json. Entry `bin: { "rustrak-mcp": "./dist/index.js" }`.
- Follow project conventions: kebab-case for files, Biome for lint/format.

**Ask First:**
- If during implementation `@modelcontextprotocol/sdk` does NOT support Zod v4 via Standard Schema, HALT — need to decide whether to use Zod v3 as an isolated dep or find an alternative.

**Never:**
- Changes to the webview-ui or Rust server.
- HTTP transport (out of scope this phase).
- MCP Resources (tools only this phase).
- Adding business logic that does not already exist in `@rustrak/client`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| list_issues happy path | `project_id: 1` | JSON with `{ items: [...], total: N }` in `content[0].text` | N/A |
| resolve_issue success | `project_id: 1, issue_id: "<uuid>"` | JSON with updated issue, `is_resolved: true` | N/A |
| Tool call → API 404 | non-existent issue_id | `isError: true`, message "Not found: ..." | No throw |
| Tool call → API 429 | Rate limit exceeded | `isError: true`, message with retry-after | No throw |
| Startup without token | `RUSTRAK_API_TOKEN` not in env | `console.error` + `process.exit(1)` | Fail fast |
| delete_issue called | `project_id, issue_id` | Void — returns message "Issue deleted successfully" | isError on failure |

</frozen-after-approval>

## Code Map

- `packages/client/src/client.ts` -- `RustrakClient` + `ClientConfig` — inject into server factory
- `packages/client/src/errors/index.ts` -- error classes for `toMcpError()`: `NotFoundError`, `RateLimitError`, `AuthenticationError`, `RustrakError`, etc.
- `packages/client/src/resources/issues.ts` -- `list(projectId, opts?)`, `get(projectId, issueId)`, `updateState(projectId, issueId, state)`, `delete(projectId, issueId)`
- `packages/client/src/resources/projects.ts` -- `list(opts?)`, `get(id)`, `create(input)`, `update(id, input)`
- `packages/client/src/resources/events.ts` -- `list(projectId, issueId, opts?)`, `get(projectId, issueId, eventId)`
- `packages/client/src/resources/tokens.ts` -- `list()`, `create(input)`, `delete(id)`
- `packages/client/src/resources/alert-channels.ts` -- `list()`, `test(id)`
- `packages/client/src/resources/alert-rules.ts` -- `list(projectId)`
- `turbo.json` -- `packages/mcp` covered by existing `packages/*` glob, no changes needed
- `pnpm-workspace.yaml` -- already includes `packages/*`, no changes needed

## Tasks & Acceptance

**Execution:**
- [x] `packages/mcp/package.json` -- created with deps `@modelcontextprotocol/sdk ^1.29.0`, `@rustrak/client workspace:*`, `zod ^4.3.6`; devdeps `tsup`, `typescript`, `vitest`; scripts `build`, `test`, `typecheck`; `bin: { rustrak-mcp: ./dist/index.js }`; `"type": "module"`
- [x] `packages/mcp/tsconfig.json` -- `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`, `strict: true`, `outDir: ./dist`
- [x] `packages/mcp/tsup.config.ts` -- entry `src/index.ts`, format `esm`, `dts: false`, `shims: true`
- [x] `packages/mcp/vitest.config.ts` -- vitest config with ESM support: `pool: 'forks'`, `environment: 'node'`, glob `tests/**/*.test.ts`
- [x] `packages/mcp/src/config.ts` -- `loadConfig()`: validates `RUSTRAK_API_URL` and `RUSTRAK_API_TOKEN`; throws on missing → `process.exit(1)` in entry point
- [x] `packages/mcp/src/errors.ts` -- `toMcpError(err: unknown)`: maps `@rustrak/client` error classes to `{ content: [{ type: 'text', text }], isError: true }`. Sanitized — never exposes stack traces.
- [x] `packages/mcp/src/tools/projects.ts` -- registers: `list_projects`, `get_project`, `create_project`
- [x] `packages/mcp/src/tools/issues.ts` -- registers: `list_issues`, `get_issue`, `resolve_issue`, `unresolve_issue`, `mute_issue`, `delete_issue` (with `destructiveHint: true`)
- [x] `packages/mcp/src/tools/events.ts` -- registers: `list_events`, `get_event`
- [x] `packages/mcp/src/tools/tokens.ts` -- registers: `list_tokens`, `create_token`, `revoke_token` (with `destructiveHint: true`)
- [x] `packages/mcp/src/tools/alerts.ts` -- registers: `list_alert_channels`, `test_alert_channel`, `list_alert_rules`
- [x] `packages/mcp/src/server.ts` -- `createServer(client: RustrakClient): McpServer` — calls all `register*Tools()`; exported for testing
- [x] `packages/mcp/src/index.ts` -- entry: `loadConfig()` → create `RustrakClient` → `createServer()` → `StdioServerTransport` → `server.connect(transport)`. Only `console.error` for logs.
- [x] `packages/mcp/tests/setup.ts` -- `createTestEnv(mockClient)`: creates server + `InMemoryTransport.createLinkedPair()` + `Client`; connects both; returns `{ mcpClient, callTool }` with typed wrapper
- [x] `packages/mcp/tests/tools/issues.test.ts` -- covers: list_issues happy path, resolve_issue happy path, 404 → isError, 429 → isError with retry-after
- [x] `packages/mcp/tests/tools/projects.test.ts` -- covers: list_projects happy path, create_project happy path
- [x] `packages/mcp/tests/integration/server.test.ts` -- `mcpClient.listTools()` returns all 18 expected tools; destructiveHint verified on delete_issue / revoke_token

**Acceptance Criteria:**
- Given `RUSTRAK_API_TOKEN` missing from env, when server starts, then `process.exit(1)` is called with error message on stderr
- Given `list_issues` called with valid `project_id`, when client returns data, then `result.isError` is falsy and `result.content[0].text` is parseable JSON with `items` field
- Given any tool when API returns `NotFoundError`, then `result.isError === true` and text contains no stack trace or internal paths
- Given `delete_issue` registered, when client lists tools via `mcpClient.listTools()`, then the tool appears with `destructiveHint: true` annotation
- Given `pnpm build --filter @rustrak/mcp`, when tsup compiles, then `dist/index.js` exists and is executable
- Given `pnpm test --filter @rustrak/mcp`, when vitest runs, then all 33 tests pass with no type errors

## Design Notes

**Server factory pattern:** `createServer(client)` receives the injected `RustrakClient` — does not create it internally. Decouples config from server and makes testing trivial with a mock.

**Tool registration:** each `src/tools/*.ts` file exports a `register*Tools(server, client)` function. `server.ts` calls all of them. Avoids a monolithic `server.ts`.

**`server.tool()` vs `server.registerTool()`:** all `server.tool()` overloads are deprecated in SDK v1.29.0. Use `server.registerTool(name, { description, inputSchema, annotations? }, handler)` exclusively.

**Test typed wrapper:** `callTool` in `tests/setup.ts` wraps `mcpClient.callTool()` with `as Promise<McpToolResult>` to bypass the `[x: string]: unknown` index signature on the SDK return type, giving test files clean access to `result.content` and `result.isError`.

**Error translation:**
```typescript
export function toMcpError(err: unknown) {
  if (err instanceof NotFoundError)
    return { content: [{ type: 'text' as const, text: `Not found: ${err.message}` }], isError: true };
  if (err instanceof RateLimitError)
    return { content: [{ type: 'text' as const, text: `Rate limited. Retry after: ${err.retryAfter ?? '?'}s` }], isError: true };
  return { content: [{ type: 'text' as const, text: `Unexpected error: ${String(err)}` }], isError: true };
}
```

## Verification

**Commands:**
- `pnpm --filter @rustrak/mcp build` -- expected: exits 0, `packages/mcp/dist/index.js` exists (11.84 KB ESM)
- `pnpm --filter @rustrak/mcp test` -- expected: 33 tests pass, 8 test files, 0 failures
- `pnpm --filter @rustrak/mcp typecheck` -- expected: 0 TypeScript errors
- `pnpm --filter @rustrak/mcp lint` -- expected: Biome 0 errors or warnings

## Spec Change Log

- **2026-05-17**: Discovered `server.tool()` is fully deprecated in SDK v1.29.0. Migrated all tool registrations to `server.registerTool()`. Config object form `{ description, inputSchema, annotations }` is the correct non-deprecated API.
- **2026-05-17**: Added `callTool` typed wrapper to `tests/setup.ts` to resolve `result.content is unknown` TS errors caused by the SDK's `[x: string]: unknown` index signature on `callTool` return type.
- **2026-05-17**: Spec translated to English and status set to `in-review`.
