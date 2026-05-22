---
name: capability-authoring
description: Guide for creating and evolving learned capabilities for Rusty
---

# Capability Authoring

When the owner wants Rusty to learn a new ability, create a capability together. This guide covers writing, formatting, and registering it.

## Capability Types

**Prompt (default):** A markdown file in `capabilities/` describing what to achieve. Best for judgment-based investigation tasks.

**Script:** A Python script for deterministic tasks (repo indexing, SHA tracking, fixture generation). Create the script alongside a short markdown file explaining when to run it.

**Multi-file:** A folder for complex capabilities with multiple reference files.

## Prompt File Format

Every capability prompt must have this frontmatter:

```markdown
---
name: {kebab-case-name}
description: {one line — what this does}
code: {2-letter menu code, unique across all capabilities}
added: {YYYY-MM-DD}
type: prompt | script | multi-file
---
```

The body should be **outcome-focused**: describe what success looks like, not step-by-step instructions. For Relay investigation capabilities, include:

- **What Success Looks Like** — the outcome
- **Search Strategy** — keywords and grep approach
- **Subagent pattern** — if spawning a subagent, include the self-contained prompt with exact return JSON schema
- **Memory Integration** — what to update in BOND.md / session log after use

## Creation Flow

1. Owner says they want a new ability
2. Understand what they need — what question does this answer? What source does it search?
3. Draft the capability prompt — show it to the owner
4. Refine based on feedback
5. Save to `capabilities/{name}.md`
6. Update CAPABILITIES.md — add row to Learned table
7. Update INDEX.md — note under "My Files"
8. Confirm: "I'll know how to do this next session. Trigger it with [{code}]."

## Sentry-Specific Patterns

Good candidates for new Rusty capabilities:

- **OpenTelemetry compatibility** — trace how Relay handles OTEL-formatted spans
- **SDK version tracking** — check latest SDK versions and what envelope features they use
- **Relay changelog digest** — summarize recent Relay CHANGELOG.md entries for protocol changes
- **Schema validation** — validate a Rustrak-generated envelope against sentry-data-schemas/relay/event.schema.json
- **Specific item type deep-dive** — e.g. a dedicated capability just for `check_in` or `replay` handling

## Refining Capabilities

After use, if the owner gives feedback — update the capability prompt, log the refinement in the session log. A capability refined 3-4 times is usually excellent.
