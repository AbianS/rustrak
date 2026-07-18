---
"@rustrak/server": "minor"
"webview-ui": "minor"
"@rustrak/client": "patch"
"@rustrak/mcp": "patch"
"docs": "patch"
---

## AI Agent Monitoring

New Agents page tracks LLM-instrumented spans from any Sentry SDK: agent runs, duration, models by calls/tokens, tool calls, and a per-trace waterfall. Deliberately ships without a cost/spend estimate, since per-model pricing tables go stale too fast to promise, so Rustrak shows exact token counts instead.

## Sentry Spans Protocol v2

Server now recognizes Spans Protocol v2, the batched wire format real Sentry SDKs (verified against @sentry/node + Vercel AI SDK) actually use for AI-instrumented spans. Previously only the legacy standalone-span format was parsed, so AI Agent Monitoring received no data from real SDKs. Also fixes cache/reasoning token attribute mapping and timestamp validation to match Relay's behavior.

## Standalone Span Ingestion

Server accepts Sentry's standalone "span" envelope item (OTel-style spans without a parent transaction), the prerequisite for AI Agent Monitoring and general span-level querying via `GET /api/projects/{id}/spans`.

## Fixes & Docs

- Source maps guide corrected for project/org resolution behavior and SvelteKit setup added
- Docs build pinned to zod 4.3.5 to fix a CI-only shallow-clone failure with nextra
