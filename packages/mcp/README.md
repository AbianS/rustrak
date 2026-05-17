# @rustrak/mcp

MCP (Model Context Protocol) server for Rustrak. Lets AI assistants (Claude Desktop, Cursor, etc.) manage your error tracking directly — list projects, inspect issues, view stack traces, resolve errors, and manage tokens without leaving your AI tool.

## Features

- **18 tools** covering projects, issues, events, tokens, and alert channels
- **stdio transport** — runs as a local process, no network port needed
- **Secure** — API token loaded from env vars, never passed as tool argument
- **Safe destructive actions** — `delete_issue` and `revoke_token` annotated with `destructiveHint`
- **Graceful errors** — all API errors returned as `isError: true` content, never thrown

## Quick Start

### 1. Generate an API token

In the Rustrak web UI: **Settings → Tokens → Create token**. Save the full token value — it is shown only once.

### 2. Configure in Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rustrak": {
      "command": "npx",
      "args": ["-y", "@rustrak/mcp"],
      "env": {
        "RUSTRAK_API_URL": "https://your-rustrak-instance.example.com",
        "RUSTRAK_API_TOKEN": "your-40-char-hex-token"
      }
    }
  }
}
```

### 3. Local monorepo (development)

Build first, then configure with a `node` command pointing to the dist:

```json
{
  "mcpServers": {
    "rustrak": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"],
      "env": {
        "RUSTRAK_API_URL": "http://localhost:8080",
        "RUSTRAK_API_TOKEN": "your-40-char-hex-token"
      }
    }
  }
}
```

Or use the project-level `.mcp.json` at the repo root (Claude Code picks this up automatically).

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RUSTRAK_API_TOKEN` | ✅ | — | 40-char hex API token. Server exits if missing. |
| `RUSTRAK_API_URL` | — | `http://localhost:8080` | Base URL of your Rustrak server. |

## Available Tools

### Projects
| Tool | Description |
|------|-------------|
| `list_projects` | List all projects |
| `get_project` | Get project details including DSN |
| `create_project` | Create a new project |

### Issues
| Tool | Description |
|------|-------------|
| `list_issues` | List issues with filters (open / resolved / muted / all) |
| `get_issue` | Get a single issue with full details |
| `resolve_issue` | Mark an issue as resolved |
| `unresolve_issue` | Re-open a resolved issue |
| `mute_issue` | Mute an issue (silences alerts) |
| `delete_issue` | ⚠️ Permanently delete an issue and all its events |

### Events
| Tool | Description |
|------|-------------|
| `list_events` | List raw events for an issue (cursor pagination) |
| `get_event` | Get a single event with full Sentry envelope data |

### Tokens
| Tool | Description |
|------|-------------|
| `list_tokens` | List API tokens (masked) |
| `create_token` | Create a new API token (full value shown once) |
| `revoke_token` | ⚠️ Permanently revoke an API token |

### Alerts
| Tool | Description |
|------|-------------|
| `list_alert_channels` | List notification channels (Slack, email, webhook) |
| `test_alert_channel` | Send a test notification to a channel |
| `list_alert_rules` | List alert rules for a project |

> ⚠️ Tools marked as destructive will prompt for confirmation in supported clients.

## Example prompts

Once connected, you can ask your AI assistant things like:

- _"List all unresolved issues in project 1"_
- _"Show me the stack trace for issue abc-123"_
- _"Resolve all TypeError issues from the last deployment"_
- _"Create a token called 'CI pipeline' and give me the value"_
- _"How many events does issue xyz have?"_

## Development

```bash
# Build
pnpm --filter @rustrak/mcp build

# Run tests (33 tests)
pnpm --filter @rustrak/mcp test

# Type check
pnpm --filter @rustrak/mcp typecheck

# Watch mode
pnpm --filter @rustrak/mcp dev
```

## Architecture

```
AI Client (Claude Desktop / Cursor)
        │  stdio (JSON-RPC)
        ▼
┌─────────────────────┐
│   @rustrak/mcp      │
│   McpServer         │
│   ├── projects      │
│   ├── issues        │
│   ├── events        │
│   ├── tokens        │
│   └── alerts        │
└──────────┬──────────┘
           │  HTTP (Bearer token)
           ▼
┌─────────────────────┐
│   Rustrak Server    │
│   (Rust/Actix-web)  │
└─────────────────────┘
```

## License

GPL-3.0
