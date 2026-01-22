---
name: skill-creator
description: Create new AI agent skills for this project. Use when asked to create a skill, add a skill, or document a new module for AI context.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Task
scope: shared
---

# Skill Creator Guide

## When to Create a New Skill

Create a skill when:
- A module has patterns that differ from generic best practices
- AI frequently needs context about a specific area
- Documentation would benefit from on-demand loading
- The pattern is used repeatedly across the project

Do NOT create a skill for:
- One-off tasks
- Trivial patterns already well-documented
- Generic technology patterns (use existing skills)

## Skill Structure

```
.claude/skills/skill-name/
├── SKILL.md                 # Required - main instructions
└── references/              # Optional - detailed docs
    ├── detailed-topic.md
    └── another-topic.md
```

## SKILL.md Template

```yaml
---
name: skill-name
description: Brief description of what this skill covers. Include trigger keywords that should activate it.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Task
---

# Skill Title

## Overview

One paragraph explaining the module/pattern this skill covers.

## Core Patterns

### Pattern 1 Name

Explain the pattern with code examples:

\`\`\`typescript
// Example code
\`\`\`

**Why this matters:** Explanation of consequences.

### Pattern 2 Name

...

## Key Files

| File | Purpose |
|------|---------|
| `path/to/file.ts` | Description |

## Common Pitfalls

1. **Mistake name:** What goes wrong and how to fix it
2. ...

## Additional Resources

For detailed documentation:
- [topic.md](references/topic.md) - Description
```

## Naming Conventions

- **Reclip-specific:** `reclip-{module}` (e.g., `reclip-editor`)
- **Technology:** `{tech}-patterns` (e.g., `zustand-patterns`)
- **Meta:** Descriptive name (e.g., `skill-creator`)

## Writing Effective Descriptions

The description determines when Claude loads the skill. Include:

1. **What it covers:** "PixiJS video rendering, timeline editing"
2. **Trigger keywords:** "Use when working on PixiCanvas, zoom effects"
3. **File hints:** "or any editor canvas functionality"

**Good:**
```yaml
description: PixiJS video rendering engine, timeline editing, zoom effects. Use when working on PixiCanvas.tsx, Timeline.tsx, or video playback.
```

**Bad:**
```yaml
description: Editor stuff.
```

## Reference Files

Use references for:
- Detailed explanations (>100 lines)
- Complex diagrams or flows
- Content that's only sometimes needed

Keep SKILL.md under 500 lines. Claude reads references on-demand.

## Testing a New Skill

1. Create the skill files
2. Start a new Claude Code session
3. Ask about the topic the skill covers
4. Verify Claude mentions loading the skill
5. Check that Claude has the right context

## Checklist for New Skills

- [ ] Name follows conventions
- [ ] Description has trigger keywords
- [ ] Core patterns documented with examples
- [ ] Key files listed with paths
- [ ] Common pitfalls included
- [ ] References extracted for detailed content
- [ ] SKILL.md under 500 lines

## Example: Creating a New Skill

If asked to create a skill for a new "effects" module:

```bash
mkdir -p .claude/skills/reclip-effects/references
```

```yaml
# .claude/skills/reclip-effects/SKILL.md
---
name: reclip-effects
description: Visual effects system for video editing - click effects, transitions, overlays. Use when working on effects rendering, effect configuration, or adding new effect types.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Task
---

# Reclip Effects System

## Overview

The effects system renders visual enhancements on top of the video...

## Core Patterns

### Effect Registration

\`\`\`typescript
const EFFECTS = {
  ripple: RippleEffect,
  glow: GlowEffect,
} as const;
\`\`\`

...
```

## Updating Existing Skills

When a module changes significantly:

1. Read the current SKILL.md
2. Update patterns that changed
3. Add new patterns if needed
4. Remove deprecated patterns
5. Update file references if paths changed

## Skills in This Project

| Skill | Purpose |
|-------|---------|
| reclip-editor | PixiJS rendering, timeline, zoom |
| reclip-recording | Screen capture, cursor sync |
| reclip-export | Export pipeline |
| reclip-projects | .reclip format |
| tauri-rust | Rust backend, Tauri commands |
| zustand-patterns | State management |
| typescript-strict | Type patterns |
| skill-creator | This skill - creating new skills |
