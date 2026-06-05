---
name: audit
description: Gap analysis between Rustrak's implementation and what Relay actually accepts. Spawns parallel subagents for source and Rustrak sides.
code: AU
---

# Audit

## What Success Looks Like

A structured gap report: for each Relay behavior found, a ✅ / ⚠️ / ❌ verdict on Rustrak's implementation — with permalink evidence on both sides. Data gaps (where Rustrak simply doesn't handle a case) are marked with a concrete fix suggestion. The owner leaves knowing exactly what to implement next.

## Before Starting

Check `~/.rusty/config.yaml` and repo state. If repos aren't cloned, run the setup from `references/search.md`. Check BOND.md for previously confirmed gaps on this topic — present them upfront so we don't re-investigate.

## Identify the Scope

From the owner's request, extract:
- **feature**: the Sentry protocol feature or envelope item to audit (e.g. "event grouping", "attachment handling", "rate limit responses")
- **keywords**: 2–5 grep terms for Relay source
- **rustrak_path**: the relevant path in Rustrak source (default: `{project-root}/apps/server/src/`)

## Spawn Two Parallel Subagents

Launch both simultaneously. Substitute actual values before spawning.

---SUBAGENT A — Relay Implementation---
Relay Audit: FEATURE
Keywords: KEYWORDS
Relay repo: ~/.rusty/relay-repo/

Steps — return ONLY JSON, no prose:

1. Get SHA: git -C ~/.rusty/relay-repo/ rev-parse HEAD

2. grep -rn "KEYWORD1\|KEYWORD2" ~/.rusty/relay-repo/relay-event-schema/ ~/.rusty/relay-repo/relay-server/src/ --include="*.rs" | head -80
   For each distinct matched file (max 5): read ±20 lines.
   Permalink: https://github.com/getsentry/relay/blob/SHA/PATH#LLINE

3. For the 1–2 most relevant files: follow outbound function calls 1 hop into relay-event-normalization.

4. Search tests: grep -rn "KEYWORD1" ~/.rusty/relay-repo/tests/ --include="*.rs" --include="*.json" | head -30
   For each test matched (max 2): extract the fixture payload shape and expected behavior.

Return JSON:
{
  "feature": "...", "sha": "...",
  "relay_behaviors": [
    { "behavior": "...", "file": "...", "line": N, "permalink": "...", "snippet": "...max 20 lines...", "key_rule": "...one line..." }
  ],
  "test_evidence": [
    { "file": "...", "permalink": "...", "fixture_shape": "...compact..." }
  ]
}
---END SUBAGENT A---

---SUBAGENT B — Rustrak Implementation---
Rustrak Audit: FEATURE
Keywords: KEYWORDS
Rustrak server: RUSTRAK_PATH

Steps — return ONLY JSON, no prose:

1. grep -rn "KEYWORD1\|KEYWORD2" RUSTRAK_PATH --include="*.rs" | head -60
   For each matched file (max 4): read ±15 lines.

2. Check HTTP status codes returned for relevant error cases.

3. Check if rate limiting headers (Retry-After) and size limit responses (413) are handled.

Return JSON:
{
  "feature": "...",
  "rustrak_behaviors": [
    { "behavior": "...", "file": "...", "line": N, "snippet": "...max 15 lines...", "key_rule": "...one line..." }
  ],
  "missing_handlers": ["...list of cases found in Relay but not in Rustrak grep..."]
}
---END SUBAGENT B---

Wait for both subagents to complete.

## Synthesize the Gap Report

For each Relay behavior from Subagent A, find the Rustrak equivalent from Subagent B:

- ✅ **Correct** — Rustrak handles it, behavior matches Relay
- ⚠️ **Different** — Rustrak handles it but behavior diverges (show both snippets + permalinks)
- ❌ **Missing** — Relay behavior has no Rustrak equivalent

For each ⚠️ / ❌:
- Cite the Relay permalink (what Relay does)
- Cite the Rustrak file:line (what Rustrak does, or "not found")
- Give a concrete fix suggestion

## Memory Integration

Before spawning subagents: check BOND.md "Known Protocol Gaps" — skip gaps already fully investigated. After synthesis: update BOND.md with newly confirmed ❌ and ⚠️ findings.

## After the Session

Session log: feature audited, verdict counts (✅/⚠️/❌), new gaps added to BOND.md.
