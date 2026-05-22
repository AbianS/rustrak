---
name: search
description: Search Relay and sentry-data-schemas source for how Sentry implements a specific protocol feature, struct, or behavior.
code: SE
---

# Search

## What Success Looks Like

The owner gets a grounded answer to "how does Sentry actually implement X?" — with a GitHub permalink anchored to a commit SHA for every finding, a relevant code snippet, and a clear statement of what Rustrak does or should do with it. If nothing is found, that's stated explicitly with a suggestion for where else to look.

## Before Starting

Check `~/.rusty/config.yaml`. If it doesn't exist, guide the owner through setup first:

```
~/.rusty/ doesn't exist yet. Let me set it up.
Creating ~/.rusty/config.yaml and cloning the repos we need.
This takes a few minutes the first time.
```

Run the setup flow:
1. Create `~/.rusty/` if absent
2. Write `~/.rusty/config.yaml` with default paths
3. Clone repos (sparse relay + full sentry-data-schemas) — see setup steps below
4. Update BOND.md with current relay SHA and date

**Setup steps (first time only):**
```bash
# Sparse clone relay — only the crates we need
git clone --filter=blob:none --sparse \
  https://github.com/getsentry/relay \
  ~/.rusty/relay-repo/
cd ~/.rusty/relay-repo/
git sparse-checkout set \
  relay-protocol \
  relay-event-schema \
  relay-base-schema \
  relay-event-normalization \
  relay-server/src \
  tests

# Full clone sentry-data-schemas (small, ~5MB)
git clone https://github.com/getsentry/sentry-data-schemas \
  ~/.rusty/sentry-data-schemas/
```

## Search Strategy

From the owner's request, extract:
- **topic**: the Sentry concept, struct, or behavior to search
- **keywords**: 2–5 grep-friendly terms (Rust struct names, field names, function names, trait names)

Spawn a subagent with the self-contained prompt below. Substitute actual values before spawning.

---SUBAGENT PROMPT START---
Sentry Source Search: TOPIC
Keywords: KEYWORDS
Relay repo: ~/.rusty/relay-repo/
Schema repo: ~/.rusty/sentry-data-schemas/

Steps — return ONLY the JSON at the end, no prose:

1. Get current relay SHA:
   git -C ~/.rusty/relay-repo/ rev-parse HEAD

2. Search relay-event-schema first (struct definitions, field types):
   grep -rn "KEYWORD1\|KEYWORD2" ~/.rusty/relay-repo/relay-event-schema/ --include="*.rs" | head -60
   For each distinct matched file (max 4): read ±20 lines around each hit.
   Permalink format: https://github.com/getsentry/relay/blob/SHA/RELATIVE_PATH#LLINE

3. Search relay-event-normalization (how Relay transforms the field):
   grep -rn "KEYWORD1\|KEYWORD2" ~/.rusty/relay-repo/relay-event-normalization/ --include="*.rs" | head -40
   For each distinct matched file (max 3): read ±15 lines around each hit.

4. Search relay tests for real fixtures:
   grep -rn "KEYWORD1\|KEYWORD2" ~/.rusty/relay-repo/tests/ --include="*.rs" --include="*.json" | head -30
   For each test file matched (max 2): read ±10 lines around each hit.

5. Check sentry-data-schemas:
   grep -rn "KEYWORD1\|KEYWORD2" ~/.rusty/sentry-data-schemas/ | head -20

Return this exact JSON:
{
  "topic": "...",
  "sha": "...",
  "schema_findings": [
    { "crate": "relay-event-schema", "file": "relative/path.rs", "line": N, "permalink": "...", "snippet": "...max 20 lines..." }
  ],
  "normalization_findings": [
    { "crate": "relay-event-normalization", "file": "...", "line": N, "permalink": "...", "snippet": "...max 15 lines..." }
  ],
  "test_fixtures": [
    { "file": "...", "permalink": "...", "snippet": "...max 10 lines..." }
  ],
  "schema_json_findings": "...relevant schema properties or null...",
  "no_results": false
}
---SUBAGENT PROMPT END---

## Synthesis

From the returned JSON (no raw file reads in main context):
- Present each schema finding: struct name, permalink, relevant snippet with field types
- Present normalization behavior: what Relay does to this field on ingestion
- Show test fixtures if found — these are the ground truth of what Relay actually accepts
- State what Rustrak should implement based on findings
- If `no_results: true`: say so explicitly, suggest fetching `develop.sentry.dev` with `[DO]` or expanding the sparse checkout

## Memory Integration

Check BOND.md for any prior findings on this topic before spawning the subagent. Check MEMORY.md for patterns. After the session, update BOND.md if a new Rustrak gap is confirmed.

## After the Session

Session log entry: topic searched, permalink(s) found, any Rustrak gap confirmed or ruled out.
