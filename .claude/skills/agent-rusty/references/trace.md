---
name: trace
description: Trace the lifecycle of an envelope or event through Relay's ingestion pipeline, step by step with permalinks.
code: TR
---

# Trace

## What Success Looks Like

A numbered call chain: from envelope receipt at the HTTP endpoint through parsing, normalization, validation, and downstream dispatch — each step with the Relay crate, function name, file:line, and a permalink. The owner understands exactly where their Rustrak implementation fits in the pipeline and what happens at each stage.

## Identify the Flow

From the owner's request, extract:
- **item_type**: the envelope item to trace (e.g. `event`, `transaction`, `session`, `check_in`, `attachment`)
- **entry_hint**: likely entry point (e.g. `EnvelopeProcessor`, `process_envelope`, HTTP handler)
- **keywords**: function names, struct names, trait names relevant to this flow

Spawn a subagent with the self-contained prompt below.

---SUBAGENT PROMPT START---
Relay Flow Trace: ITEM_TYPE
Entry hint: ENTRY_HINT
Keywords: KEYWORDS
Relay repo: ~/.rusty/relay-repo/

Steps — return ONLY JSON, no prose:

1. Get SHA: git -C ~/.rusty/relay-repo/ rev-parse HEAD
   Permalink base: https://github.com/getsentry/relay/blob/SHA

2. Locate entry point in relay-server/src/:
   grep -rn "ENTRY_HINT\|KEYWORD1" ~/.rusty/relay-repo/relay-server/src/ --include="*.rs" | head -20
   Read the entry function body (max 50 lines).

3. Trace the call chain — follow outbound calls 4–6 hops:
   For each called function: grep to find its definition, read body (max 30 lines).
   Cross crate boundaries into relay-event-normalization when the call goes there.
   Stop at: external I/O, Kafka dispatch, error returns, or after 6 hops. Max 8 total files read.

4. Find test that exercises this full flow:
   grep -rn "KEYWORD1\|ITEM_TYPE" ~/.rusty/relay-repo/tests/ --include="*.rs" | head -20
   For first test found: extract the input fixture shape (max 20 lines).

Return JSON:
{
  "item_type": "...",
  "sha": "...",
  "call_chain": [
    {
      "step": 1,
      "crate": "relay-server",
      "function": "process_envelope",
      "file": "relay-server/src/...",
      "line": N,
      "permalink": "...",
      "snippet": "...max 15 lines...",
      "what_happens": "...one line..."
    }
  ],
  "test_fixture": {
    "file": "...",
    "permalink": "...",
    "input_shape": "...compact fixture..."
  },
  "flow_summary": "...2-3 line description of the complete flow..."
}
---SUBAGENT PROMPT END---

## Synthesis

From the returned JSON (no raw reads in main context):
- Present the call chain as a numbered sequence with crate → function → permalink
- Highlight crate boundary crossings (relay-server → relay-event-normalization)
- Show the test fixture input shape — this is what Rustrak's equivalent must accept
- Map each step to what Rustrak's implementation does or should do

## Memory Integration

After the trace: note in the session log which pipeline stages Rustrak covers vs. which are missing. Update BOND.md if a gap is confirmed.
