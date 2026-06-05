---
name: fixture
description: Extract real test payloads and envelope fixtures from Relay and SDK test suites to validate Rustrak behavior.
code: FI
---

# Fixture

## What Success Looks Like

The owner gets concrete, ready-to-use envelope payloads that represent what real Sentry SDKs send — extracted from Relay's own test suite or the official SDK test fixtures. Each fixture comes with: the source permalink, what the fixture tests, and whether Rustrak's ingestion handles it correctly.

## Identify What's Needed

From the owner's request, extract:
- **item_type**: the envelope item type they want fixtures for (e.g. `event`, `transaction`, `session`, `check_in`, `attachment`, etc.)
- **scenario**: specific edge case or scenario (e.g. "error event with stacktrace", "session with crashed status", "envelope with multiple items")

## Find Fixtures

Spawn a subagent with the self-contained prompt below.

---SUBAGENT PROMPT START---
Fixture Search: ITEM_TYPE — SCENARIO
Keywords: KEYWORDS
Relay repo: ~/.rusty/relay-repo/

Steps — return ONLY JSON, no prose:

1. Get SHA: git -C ~/.rusty/relay-repo/ rev-parse HEAD

2. Search relay tests for JSON fixtures:
   find ~/.rusty/relay-repo/tests/ -name "*.json" | xargs grep -li "KEYWORD1" 2>/dev/null | head -10
   For each fixture file found (max 4): read the full file (max 100 lines).
   Permalink: https://github.com/getsentry/relay/blob/SHA/RELATIVE_PATH

3. Search relay tests for inline fixtures in Rust:
   grep -rn "KEYWORD1\|ITEM_TYPE" ~/.rusty/relay-repo/tests/ --include="*.rs" | head -40
   For each matched test (max 3): read ±25 lines to capture the fixture construction.

4. Search relay-event-normalization tests for normalization fixtures:
   grep -rn "KEYWORD1" ~/.rusty/relay-repo/relay-event-normalization/tests/ --include="*.rs" 2>/dev/null | head -30
   For each matched (max 2): read ±20 lines.

Return JSON:
{
  "item_type": "...",
  "sha": "...",
  "fixtures": [
    {
      "source": "json_file | rust_inline | normalization_test",
      "file": "relative/path",
      "permalink": "...",
      "what_it_tests": "...one line...",
      "payload": "...the actual fixture content, compact...",
      "expected_behavior": "...what Relay expects to happen..."
    }
  ],
  "no_results": false
}
---SUBAGENT PROMPT END---

## Synthesis

For each fixture:
- Show the payload (formatted for readability)
- State what behavior it exercises
- Check if Rustrak handles it: `grep -rn "ITEM_TYPE\|KEYWORD" {project-root}/apps/server/src/ --include="*.rs" | head -20`
- Verdict: ✅ Rustrak handles this / ❌ Rustrak likely fails this / ❓ unclear — needs manual test

## Deliver Runnable Payloads

For each fixture, provide the envelope in ready-to-send format using `packages/test-sentry` if applicable, or as a raw curl command:

```bash
curl -X POST http://localhost:8080/api/1/envelope/ \
  -H "Content-Type: application/x-sentry-envelope" \
  --data-binary @- <<'EOF'
{"dsn":"http://key@localhost:8080/1","sent_at":"2026-05-22T00:00:00Z"}
{"type":"ITEM_TYPE","length":N}
{...payload...}
EOF
```

## Memory Integration

If fixtures reveal a Rustrak handling gap, add to BOND.md "Known Protocol Gaps" and session log.
