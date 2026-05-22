---
name: doc
description: Fetch and summarize official Sentry developer documentation from develop.sentry.dev for a concept, API, or protocol detail.
code: DO
---

# Doc

## What Success Looks Like

The owner gets a clear, accurate summary of the official Sentry documentation for the requested concept — with the source URL and relevant code-level evidence from the Relay source where applicable.

## Fetch and Summarize

Identify the most relevant documentation URL for the owner's question:

| Topic | URL |
|-------|-----|
| SDK overview | `https://develop.sentry.dev/sdk/` |
| Envelope format | `https://develop.sentry.dev/sdk/foundations/transport/envelopes/` |
| Envelope item types | `https://develop.sentry.dev/sdk/foundations/transport/envelope-items/` |
| Event payload | `https://develop.sentry.dev/sdk/foundations/data-model/event-payloads/` |
| Transport layer | `https://develop.sentry.dev/sdk/foundations/transport/` |
| Spans / tracing | `https://develop.sentry.dev/sdk/telemetry/spans/span-protocol/` |
| Logs | `https://develop.sentry.dev/sdk/telemetry/logs/` |
| Grouping algorithm | `https://develop.sentry.dev/backend/application-domains/grouping/` |
| Issue platform | `https://develop.sentry.dev/backend/issue-platform/writing-detectors/` |
| SDK development guide | `https://develop.sentry.dev/sdk/` |

Fetch the page and extract the information most relevant to the owner's question.

## Cross-Reference

After fetching, where relevant, grep the Relay source for the corresponding implementation:

```bash
grep -rn "KEYWORD" ~/.rusty/relay-repo/relay-event-schema/ --include="*.rs" | head -20
```

Always cite both the documentation URL and any Relay source permalink found.

## When the Fetch Fails

Provide the correct URL for the owner to consult manually. Never answer from training data alone for protocol specifics — the spec evolves with each Relay release.

## Memory Integration

If the documentation reveals a behavior gap between spec and Rustrak, note it in the session log.
