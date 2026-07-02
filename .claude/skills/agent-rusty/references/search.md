---
name: search
description: Search Relay, sentry-data-schemas, and the sentry monolith source for how Sentry implements a specific protocol feature, struct, or behavior.
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
3. Clone repos (sparse relay + full sentry-data-schemas + shallow sentry monolith) — see setup steps below
4. Update BOND.md with current SHAs and date

If `~/.rusty/config.yaml` exists but is missing `sentry_repo` (upgrading an older sanctum), just clone the monolith and append the line — no need to redo the other two repos.

**Setup steps (first time only, or to add a missing repo):**
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

# Shallow clone the sentry monolith (~300MB, no git history — a fresh
# `git clone --depth=1` is how you "refresh" it later, since a depth=1
# clone can't `fetch --dry-run` sensibly)
git clone --depth=1 \
  https://github.com/getsentry/sentry \
  ~/.rusty/sentry-repo/
```

## Which Repo Owns the Answer

Not every Sentry behavior lives in Relay. Pick the repo by what's actually being asked:

- **Relay** (`~/.rusty/relay-repo/`) — anything in the ingestion path: envelope parsing, event normalization, PII scrubbing, rate limiting, grouping/fingerprinting inputs, protocol-level validation. If Rustrak's job is "accept what an SDK sends the same way Relay does," it's here.
- **sentry-data-schemas** (`~/.rusty/sentry-data-schemas/`) — canonical JSON Schema definitions for the wire protocol.
- **sentry monolith** (`~/.rusty/sentry-repo/`) — anything Relay hands off rather than owns: issue status/substatus lifecycle and regression detection (`src/sentry/models/group*.py`, `src/sentry/issues/`), assignment, bulk issue API, alerting/notification rules, the public REST API surface, dashboards. If the question is "what does the *product* do after ingestion," it's here, not in Relay.

When unsure which owns it, search Relay first (it's the smaller, faster search) — if `no_results`, fall through to the monolith rather than guessing.

## Search Strategy

From the owner's request, extract:
- **topic**: the Sentry concept, struct, or behavior to search
- **keywords**: 2–5 grep-friendly terms (struct/class names, field names, function names)
- **target**: `relay` (default), `monolith`, or `both` — see "Which Repo Owns the Answer" above

Spawn a subagent with the self-contained prompt below. Substitute actual values before spawning. Use the Relay-only prompt when `target: relay`; add the monolith steps when `target: monolith` or `both`.

---SUBAGENT PROMPT START---
Sentry Source Search: TOPIC
Keywords: KEYWORDS
Relay repo: ~/.rusty/relay-repo/
Schema repo: ~/.rusty/sentry-data-schemas/
Monolith repo: ~/.rusty/sentry-repo/ (only search if TARGET is "monolith" or "both")

Steps — return ONLY the JSON at the end, no prose:

1. Get current SHAs:
   git -C ~/.rusty/relay-repo/ rev-parse HEAD
   git -C ~/.rusty/sentry-repo/ rev-parse HEAD   # only if searching monolith

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

6. If TARGET is "monolith" or "both" — search the sentry monolith. Scope the
   grep to likely directories first so it doesn't crawl the whole repo:
   grep -rn "KEYWORD1\|KEYWORD2" ~/.rusty/sentry-repo/src/sentry/issues/ ~/.rusty/sentry-repo/src/sentry/models/ ~/.rusty/sentry-repo/src/sentry/api/endpoints/ --include="*.py" | head -60
   If that returns nothing, widen to ~/.rusty/sentry-repo/src/sentry/ (still `--include="*.py"`, still piped to `head -60`).
   For each distinct matched file (max 4): read ±20 lines around each hit.
   For each matched file, also check tests/sentry/ for the same basename (max 2 files, ±15 lines).
   Permalink format: https://github.com/getsentry/sentry/blob/SHA/RELATIVE_PATH#LLINE
   (Note: sentry-repo is a depth=1 shallow clone — the permalink SHA is real and resolves on GitHub, but `git log`/`git blame` won't work locally.)

Return this exact JSON:
{
  "topic": "...", "target": "relay|monolith|both",
  "sha": "...", "monolith_sha": "...or null",
  "schema_findings": [
    { "crate": "relay-event-schema", "file": "relative/path.rs", "line": N, "permalink": "...", "snippet": "...max 20 lines..." }
  ],
  "normalization_findings": [
    { "crate": "relay-event-normalization", "file": "...", "line": N, "permalink": "...", "snippet": "...max 15 lines..." }
  ],
  "test_fixtures": [
    { "file": "...", "permalink": "...", "snippet": "...max 10 lines..." }
  ],
  "monolith_findings": [
    { "file": "src/sentry/...", "line": N, "permalink": "...", "snippet": "...max 20 lines...", "test_evidence": "...matching test file/snippet or null" }
  ],
  "schema_json_findings": "...relevant schema properties or null...",
  "no_results": false
}
---SUBAGENT PROMPT END---

## Synthesis

From the returned JSON (no raw file reads in main context):
- Present each schema finding: struct name, permalink, relevant snippet with field types
- Present normalization behavior: what Relay does to this field on ingestion
- Present monolith findings the same way when present — permalink, snippet, and note whether it's product logic (Python, monolith) vs protocol logic (Rust, Relay), since Rustrak needs to know which one it's actually reimplementing
- Show test fixtures if found — these are the ground truth of what Relay/monolith actually does
- State what Rustrak should implement based on findings
- If `no_results: true`: say so explicitly, suggest fetching `develop.sentry.dev` with `[DO]`, expanding the sparse checkout, or re-running with `target: monolith` if it was Relay-only

## Memory Integration

Check BOND.md for any prior findings on this topic before spawning the subagent. Check MEMORY.md for patterns. After the session, update BOND.md if a new Rustrak gap is confirmed. If a finding resolves a previously-flagged "out of scope, monolith not cloned" gap, update that row's verdict too.

## After the Session

Session log entry: topic searched, which repo(s) it came from, permalink(s) found, any Rustrak gap confirmed or ruled out.
