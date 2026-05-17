# Rustrak MCP - Model Context Protocol Server

> **Context Note**: This is the **MCP package context** for Rustrak.
> - Root context: `/CLAUDE.md`
> - Server API: `apps/server/CLAUDE.md`
> - WebView UI: `apps/webview-ui/CLAUDE.md`
> - Client Package: `packages/client/CLAUDE.md`

## Overview

`@rustrak/mcp` is an MCP (Model Context Protocol) server that wraps `@rustrak/client` and exposes 18 tools so AI assistants (Claude Desktop, Cursor, etc.) can manage Rustrak error tracking directly — list projects, inspect issues, view stack traces, resolve errors, and manage tokens without leaving the AI tool.

**Key Features:**
- 18 tools covering projects, issues, events, tokens, and alert channels
- stdio transport — runs as a local process, no network port needed
- Secure — API token loaded from env vars, never passed as a tool argument
- Safe destructive actions — `delete_issue` and `revoke_token` annotated with `destructiveHint`
- Graceful errors — all API errors returned as `isError: true` content, never thrown

## Architecture

```
AI Client (Claude Desktop / Cursor / Claude Code)
        │  stdio (JSON-RPC)
        ▼
┌─────────────────────┐
│   @rustrak/mcp      │
│   McpServer         │
│   ├── projects      │  ← registerProjectTools()
│   ├── issues        │  ← registerIssueTools()
│   ├── events        │  ← registerEventTools()
│   ├── tokens        │  ← registerTokenTools()
│   └── alerts        │  ← registerAlertTools()
└──────────┬──────────┘
           │  HTTP (Bearer token)
           ▼
┌─────────────────────┐
│   @rustrak/client   │  ← RustrakClient (injected)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Rustrak Server    │
│   (Rust/Actix-web)  │
└─────────────────────┘
```

## Tech Stack

- **MCP SDK**: [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) v1.29.0
- **Validation**: [Zod](https://zod.dev) v4+ (Standard Schema — compatible with SDK v1.10+)
- **Client**: `@rustrak/client` workspace package
- **Build Tool**: [tsup](https://tsup.egoist.dev) (ESM output, `"type": "module"`)
- **Testing**: [Vitest](https://vitest.dev) + `InMemoryTransport` (in-process, no subprocess)
- **TypeScript**: v5.9+ (strict mode, NodeNext module resolution)

## Project Structure

```
packages/mcp/
├── CLAUDE.md              # This file
├── README.md              # Usage and quick-start documentation
├── package.json           # @rustrak/mcp (type: module, bin: rustrak-mcp)
├── tsconfig.json          # Strict TypeScript, NodeNext module resolution
├── tsup.config.ts         # ESM-only build, entry: src/index.ts
├── vitest.config.ts       # pool: forks (ESM support), tests/**/*.test.ts
│
├── src/
│   ├── index.ts           # Entry: loadConfig → RustrakClient → server → stdio
│   ├── server.ts          # createServer(client): McpServer — factory, exported for testing
│   ├── config.ts          # loadConfig(): validates RUSTRAK_API_URL + RUSTRAK_API_TOKEN
│   ├── errors.ts          # toMcpError(err): maps client errors → { isError, content }
│   │
│   └── tools/
│       ├── projects.ts    # list_projects, get_project, create_project
│       ├── issues.ts      # list_issues, get_issue, resolve_issue, unresolve_issue, mute_issue, delete_issue
│       ├── events.ts      # list_events, get_event
│       ├── tokens.ts      # list_tokens, create_token, revoke_token
│       └── alerts.ts      # list_alert_channels, test_alert_channel, list_alert_rules
│
├── tests/
│   ├── setup.ts           # createTestEnv(mockClient): typed callTool wrapper
│   ├── config.test.ts     # loadConfig env var validation
│   │
│   ├── tools/
│   │   ├── projects.test.ts
│   │   ├── issues.test.ts
│   │   ├── events.test.ts
│   │   ├── tokens.test.ts
│   │   └── alerts.test.ts
│   │
│   └── integration/
│       └── server.test.ts # listTools() → 18 tools, destructiveHint verified
│
└── dist/                  # Build output (ESM only)
    └── index.js           # Executable MCP server (~12KB)
```

## Design Patterns

### 1. Server Factory Pattern

`createServer(client)` receives the injected `RustrakClient` — does not create it internally. This decouples configuration from the server and makes testing trivial.

```typescript
// src/server.ts
export function createServer(client: RustrakClient): McpServer {
  const server = new McpServer({ name: 'rustrak-mcp-server', version: '0.1.0' });
  registerProjectTools(server, client);
  registerIssueTools(server, client);
  registerEventTools(server, client);
  registerTokenTools(server, client);
  registerAlertTools(server, client);
  return server;
}
```

**Why factory pattern?**
- Decouples env config from server construction
- `createServer(mockClient)` in tests — no real HTTP calls
- Each tool file is independently testable

### 2. Tool Registration Per File

Each `src/tools/*.ts` file exports one `register*Tools(server, client)` function. No monolithic `server.ts`.

```typescript
// src/tools/issues.ts
export function registerIssueTools(server: McpServer, client: RustrakClient) {
  server.registerTool(
    'list_issues',
    {
      description: 'List issues for a project.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        status: z.enum(['open', 'resolved', 'muted', 'all']).optional(),
      },
    },
    async ({ project_id, status }) => {
      try {
        const result = await client.issues.list(project_id, { status });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );
}
```

**CRITICAL**: Always use `server.registerTool()`. All `server.tool()` overloads are deprecated in SDK v1.29.0.

### 3. Error Translation (`toMcpError`)

Tool handlers never throw. API errors are caught and returned as `isError: true` content so the LLM can see and handle the error.

```typescript
// src/errors.ts
export function toMcpError(err: unknown) {
  if (err instanceof NotFoundError)
    return { content: [{ type: 'text' as const, text: `Not found: ${err.message}` }], isError: true };
  if (err instanceof RateLimitError)
    return { content: [{ type: 'text' as const, text: `Rate limited. Retry after: ${err.retryAfter ?? '?'}s` }], isError: true };
  if (err instanceof AuthenticationError)
    return { content: [{ type: 'text' as const, text: 'Authentication failed. Check RUSTRAK_API_TOKEN.' }], isError: true };
  return { content: [{ type: 'text' as const, text: `Unexpected error: ${String(err)}` }], isError: true };
}
```

**Rules:**
- Never expose stack traces or internal paths in error text
- Map every known `@rustrak/client` error class explicitly
- Fall through to `String(err)` for unknown errors

### 4. Destructive Tool Annotations

Tools that permanently delete data are annotated with `destructiveHint: true`. Supported MCP clients will prompt for confirmation before executing.

```typescript
server.registerTool(
  'delete_issue',
  {
    description: 'Permanently delete an issue and all its events.',
    inputSchema: {
      project_id: z.number().int().describe('Project ID'),
      issue_id: z.string().describe('Issue ID'),
    },
    annotations: { destructiveHint: true },
  },
  async ({ project_id, issue_id }) => { ... },
);
```

Destructive tools: `delete_issue`, `revoke_token`.

### 5. Typed Test Wrapper (`callTool`)

`mcpClient.callTool()` returns `{ [x: string]: unknown }` — the index signature makes `content` and `isError` unknown. The test setup uses a typed cast to fix this cleanly across all tests.

```typescript
// tests/setup.ts
export type McpTextContent = { type: 'text'; text: string };
export type McpToolResult = { isError?: boolean; content: McpTextContent[] };

export async function createTestEnv(mockClient: unknown) {
  const server = createServer(mockClient as never);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcpClient = new Client({ name: 'test', version: '1.0.0' });
  await server.connect(serverTransport);
  await mcpClient.connect(clientTransport);
  const callTool = (params: Parameters<typeof mcpClient.callTool>[0]): Promise<McpToolResult> =>
    mcpClient.callTool(params) as Promise<McpToolResult>;
  return { mcpClient, server, callTool };
}
```

**Usage in tests:**
```typescript
let callTool: Awaited<ReturnType<typeof createTestEnv>>['callTool'];

beforeEach(async () => {
  testEnv = await createTestEnv(mockClient);
  callTool = testEnv.callTool;
});

it('returns issues', async () => {
  const result = await callTool({ name: 'list_issues', arguments: { project_id: 1 } });
  expect(result.isError).toBeFalsy();
  const parsed = JSON.parse(result.content[0].text);
  expect(parsed.items).toBeDefined();
});
```

## Key Rules for Agents

**stdio transport:**
- `console.log` is **FORBIDDEN** — corrupts the JSON-RPC stream
- Only `console.error` for diagnostic output (goes to stderr, not stdout)

**Auth:**
- Credentials come from `RUSTRAK_API_URL` and `RUSTRAK_API_TOKEN` env vars only
- Never accept tokens as tool arguments
- `loadConfig()` exits with `process.exit(1)` if env vars are missing

**Tool registration:**
- Always `server.registerTool()` — never `server.tool()`
- Input schema uses Zod v4 objects (Standard Schema)
- Annotations go in the second argument: `{ description, inputSchema, annotations? }`

**Error handling:**
- Every tool handler must have a `try/catch` that calls `toMcpError(err)`
- Never `throw` from a tool handler

**Adding a new tool:**
1. Add handler to the appropriate `src/tools/*.ts` file
2. Write a failing test first (TDD — see `.claude/skills/tdd`)
3. Implement the minimum code to pass
4. Verify `mcpClient.listTools()` includes the new tool in `tests/integration/server.test.ts`

## Testing

### Running Tests

```bash
# Run all tests (33 tests)
pnpm test

# Watch mode
pnpm dev

# Type check
pnpm typecheck
```

### Test Coverage

- **Config tests** (3 tests): missing URL, missing token, both present
- **Tool tests** (25 tests): happy path + error cases for all 5 tool groups
- **Integration tests** (5 tests): `listTools()` returns all 18 tools, `destructiveHint` on delete/revoke

### InMemoryTransport

Tests use `InMemoryTransport.createLinkedPair()` — in-process, no subprocess, no real network. Fast and deterministic.

```typescript
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);
await mcpClient.connect(clientTransport);
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RUSTRAK_API_TOKEN` | Yes | — | 40-char hex API token. Server exits if missing. |
| `RUSTRAK_API_URL` | No | `http://localhost:8080` | Base URL of your Rustrak server. |

### Local Development (.mcp.json)

The repo root `.mcp.json` is picked up by Claude Code automatically:

```json
{
  "mcpServers": {
    "rustrak": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"],
      "env": {
        "RUSTRAK_API_URL": "http://localhost:8080",
        "RUSTRAK_API_TOKEN": "<your-token>"
      }
    }
  }
}
```

Build before connecting: `pnpm --filter @rustrak/mcp build`

## Development

### Building

```bash
pnpm build
# Outputs: dist/index.js (ESM, ~12KB)
```

### Adding a New Tool Group

1. Create `src/tools/new-group.ts` with `registerNewGroupTools(server, client)`
2. Import and call it in `src/server.ts`
3. Create `tests/tools/new-group.test.ts` (TDD — test first)
4. Update the tool count in `tests/integration/server.test.ts`

## Skills to Use

When working on this package:
- **tdd** — Write failing test first, then minimum implementation, then refactor
- **typescript-strict** — Type-safe patterns, Zod usage
- **rust-coder** — When understanding the server API to add new tools

## References

- **MCP TypeScript SDK**: https://github.com/modelcontextprotocol/typescript-sdk
- **MCP Specification**: https://modelcontextprotocol.io
- **Client Package**: `packages/client/CLAUDE.md`
- **TDD Skill**: `.claude/skills/tdd/SKILL.md`
- **Spec**: `_bmad-output/implementation-artifacts/spec-mcp-package.md`
