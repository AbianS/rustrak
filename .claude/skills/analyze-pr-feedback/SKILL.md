---
name: analyze-pr-feedback
description: 'Analyze Rustrak PR review threads, verdict each as real error vs false positive, fix approved items, commit, push, resolve threads. Use when on a PR branch or given a PR number and wanting to address review feedback.'
---

# analyze-pr-feedback

Analyzes all review comments on a Rustrak PR — bots and humans alike — against the actual codebase. Produces evidence-based verdicts, applies user-approved fixes, commits and pushes, then resolves all threads on GitHub.

**Your role:** Senior Rustrak developer. Deep knowledge of the stack (Rust/Actix-web, TypeScript/Zod, Next.js). Analytical, skeptical, evidence-driven. Bots are frequently wrong — never accept a bot comment at face value without verifying it against real code. Your verdict comes from reading the code, not the diff.

**Invocation:** `/analyze-pr-feedback [pr_number]`

If no `pr_number` is given, auto-detect it from the current branch.

---

## GLOBAL RULES

- Read the full step file before taking any action
- Execute sections in order — no skipping
- Halt at every pause point and wait for user confirmation
- Load the next step only when directed — never preload
- **NEVER** commit, push, or call the GitHub API without explicit user approval
- **FALLBACK:** If an instruction references a subprocess or subagent not available, achieve the outcome in the main thread
- **Silent success:** Only display output at decision points and on errors

---

## STEP MAP

```
INPUT: pr_number (explicit arg or auto-detected from current branch)
│
step-01-init-fetch        [auto]
├── Resolve PR number
├── Fetch PR metadata
├── GraphQL: all review threads
├── REST: general reviews
├── Filter resolved, classify bot/human
└── → step-02-analyze

step-02-analyze           [auto]
├── Load project context (CLAUDE.md files + relevant docs)
├── Per thread: read real code, understand claim, investigate thoroughly
│   └── Verdict: REAL | FALSE_POSITIVE + evidence + fix_approach / fp_explanation
└── → step-03-decision

step-03-decision          ← PAUSE: user decides
├── Compact table (all threads, all verdicts)
├── [A] Fix all real errors        → step-04-fix-commit
├── [S] Select by index            → step-04-fix-commit
├── [N] None                       → step-05-resolve
└── [C] Cancel → stop

step-04-fix-commit        ← PAUSE: confirm commit
├── Apply approved fixes (Edit tool only)
├── Adaptive lint/test pipeline by file type
├── Show git diff --stat + proposed commit message
├── [Confirmed] git commit + push to pr_head_branch
└── → step-05-resolve

step-05-resolve           ← PAUSE: confirm GitHub API calls
├── Show resolution plan
├── [Confirmed] GraphQL: resolve fixed threads
├── REST: reply + resolve FP threads
├── Reply + resolve skipped threads
└── Inline final summary
```

---

## INITIALIZATION

Extract `pr_number` from the argument if provided. Then load and execute `references/step-01-init-fetch.md`.
