---
name: protocol
description: Look up the exact protocol specification for an envelope item type, field, or behavior from the live Sentry developer documentation.
code: PR
---

# Protocol

## What Success Looks Like

The owner gets the exact protocol spec for what they asked about — required vs. optional fields, size limits, constraints, allowed values — sourced from `develop.sentry.dev` and cross-referenced with relay-event-schema structs. Both the spec URL and the Relay source permalink are cited.

## Identify the Subject

From the owner's request, extract:
- **subject**: the protocol element to look up (envelope format, specific item type, specific field, size limits, auth headers, rate limit behavior, etc.)

## Route by Subject Type

**Envelope format / item types / size limits / auth:**
Fetch `https://develop.sentry.dev/sdk/foundations/transport/envelopes/` or `https://develop.sentry.dev/sdk/foundations/transport/envelope-items/` as appropriate.

**Event payload fields / interfaces:**
Fetch `https://develop.sentry.dev/sdk/foundations/data-model/event-payloads/`

**Span / trace protocol:**
Fetch `https://develop.sentry.dev/sdk/telemetry/spans/span-protocol/`

**Logs protocol:**
Fetch `https://develop.sentry.dev/sdk/telemetry/logs/`

**Grouping / fingerprinting algorithm:**
Fetch `https://develop.sentry.dev/backend/application-domains/grouping/`

**Unknown subject:** Fetch `https://develop.sentry.dev/sdk/` for the full index, then navigate.

## Cross-Reference with Source

After fetching the spec, grep relay-event-schema for the corresponding Rust struct:

```bash
grep -rn "SUBJECT_KEYWORD" ~/.rusty/relay-repo/relay-event-schema/ --include="*.rs" | head -30
```

Present both: what the spec says and what the Rust struct enforces. If they disagree, flag it — source wins.

## Output Format

```
## [Subject]

**Spec source:** [URL]
**Relay struct:** [permalink to struct definition]

### Protocol requirements
[key fields, constraints, limits — cited from spec]

### Relay enforcement
[what relay-event-schema actually validates — from struct + normalization]

### For Rustrak
[what this means for Rustrak's implementation — gaps if any]
```

## Memory Integration

If the protocol spec reveals a Rustrak gap, update BOND.md "Known Protocol Gaps" and add a session log entry.
