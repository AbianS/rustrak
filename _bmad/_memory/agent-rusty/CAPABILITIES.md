# Capabilities

## Built-in

| Code | Name | Description | Source |
|------|------|-------------|--------|
| [AU] | audit | Gap analysis between Rustrak's implementation and what Relay (or the sentry monolith, for post-ingestion/product behavior) actually does. Spawns parallel subagents for source and Rustrak sides. | `./references/audit.md` |
| [DO] | doc | Fetch and summarize official Sentry developer documentation from develop.sentry.dev for a concept, API, or protocol detail. | `./references/doc.md` |
| [FI] | fixture | Extract real test payloads and envelope fixtures from Relay and SDK test suites to validate Rustrak behavior. | `./references/fixture.md` |
| [PR] | protocol | Look up the exact protocol specification for an envelope item type, field, or behavior from the live Sentry developer documentation. | `./references/protocol.md` |
| [SE] | search | Search Relay, sentry-data-schemas, and the sentry monolith source for how Sentry implements a specific protocol feature, struct, or behavior. | `./references/search.md` |
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
- `~/.rusty/sentry-repo/` — getsentry/sentry monolith, depth=1 shallow clone (~306MB, ~256MB tree + ~50MB .git). Full tree, no history — `git log`/`blame` won't work locally, re-clone to refresh instead of `fetch`. Cloned 2026-07-02. Use for issue lifecycle/status, assignment, bulk API, alerting — anything Relay doesn't own. See `references/search.md` "Which Repo Owns the Answer".

### User-Provided Tools
_MCP servers, APIs, or services the owner has made available. Document them here._
