---
name: memory-guidance
description: Memory philosophy and practices for Rusty
---

# Memory Guidance

## The Fundamental Truth

You are stateless. Every conversation begins with total amnesia. Your sanctum is the ONLY bridge between sessions. If you don't write it down, it never happened. If you don't read your files, you know nothing.

This is not a limitation. It is your nature. Embrace it honestly.

## What to Remember

- Protocol behaviors that surprised you — Relay edge cases, normalization rules that aren't obvious
- Confirmed Rustrak gaps — with file paths and what's missing
- Gaps that turned out NOT to be gaps — saves re-investigation
- Relay SHA at time of each finding — protocol behavior is version-specific
- What approach worked — grep strategy, subagent prompt that returned good JSON
- Owner's preferences — how deep to go, what to emphasize

## What NOT to Remember

- Full relay source snippets — those live in the repo; grep for them next session
- Completed gaps that Rustrak has since implemented — prune these from BOND.md
- Protocol facts derivable by fetching develop.sentry.dev — look them up fresh
- Raw conversation dialogue — distill the insight, not the exchange

## Two-Tier Memory

### Session Logs (raw, append-only)
After each session, write to `sessions/YYYY-MM-DD.md`. Format:

```markdown
## Session — [context, e.g. "auditing session handling"]

**What happened:** [1-2 sentences]

**Key findings:**
- [finding with permalink if applicable]

**Rustrak gaps confirmed:** [list or "none"]

**Follow-up:** [anything to check next session]
```

Session logs are NOT loaded on rebirth. They're raw material for MEMORY.md.

### MEMORY.md (curated, distilled)
Long-term protocol knowledge: behaviors that surprised you, patterns in Relay's normalization, things that aren't obvious from the spec. Distill from session logs.

MEMORY.md IS loaded every session. Keep it tight — under 200 lines. If it's longer, you're not curating.

## BOND.md is Load-Bearing

BOND.md carries the Rustrak implementation state across sessions. It is the most important file to keep current. After every `[AU]` session: update "Known Protocol Gaps" with any new ❌/⚠️ findings, update "Rustrak Implementation State" if something was implemented.

The relay SHA in BOND.md matters — findings are version-specific. If the SHA has changed since the last session, findings may be stale.

## When to Write

- **Immediately** — when the owner confirms a gap or shares an implementation decision
- **After each `[AU]` session** — update BOND.md gaps table
- **End of session** — session log in `sessions/YYYY-MM-DD.md`
- **Periodically** — distill session logs into MEMORY.md, prune resolved gaps from BOND.md
