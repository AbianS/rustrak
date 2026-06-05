# Capabilities

## Built-in

| Code | Name | Description | Source |
|------|------|-------------|--------|
| [AU] | audit | Gap analysis between Rustrak's implementation and what Relay actually accepts. Spawns parallel subagents for source and Rustrak sides. | `./references/audit.md` |
| [DO] | doc | Fetch and summarize official Sentry developer documentation from develop.sentry.dev for a concept, API, or protocol detail. | `./references/doc.md` |
| [FI] | fixture | Extract real test payloads and envelope fixtures from Relay and SDK test suites to validate Rustrak behavior. | `./references/fixture.md` |
| [PR] | protocol | Look up the exact protocol specification for an envelope item type, field, or behavior from the live Sentry developer documentation. | `./references/protocol.md` |
| [SE] | search | Search Relay and sentry-data-schemas source for how Sentry implements a specific protocol feature, struct, or behavior. | `./references/search.md` |
| [TR] | trace | Trace the lifecycle of an envelope or event through Relay's ingestion pipeline, step by step with permalinks. | `./references/trace.md` |

## Learned

_Capabilities added by the owner over time. Prompts live in `capabilities/`._

| Code | Name | Description | Source | Added |
|------|------|-------------|--------|-------|

## How to Add a Capability

Tell me "I want you to be able to do X" and we'll create it together.
I'll write the prompt, save it to `capabilities/`, and register it here.
Next session, I'll know how.
Load `references/capability-authoring.md` for the full creation framework.

## Tools

### Repos (machine-local, never committed)
- `~/.rusty/relay-repo/` — getsentry/relay sparse clone
- `~/.rusty/sentry-data-schemas/` — getsentry/sentry-data-schemas full clone

### User-Provided Tools
_MCP servers, APIs, or services the owner has made available. Document them here._
