---
name: step-02-analyze
description: Load project context, exhaustive per-thread analysis against real code, verdict REAL or FALSE_POSITIVE with evidence
nextStep: references/step-03-decision.md
---

# Step 2: Analyze

## GOAL

Produce an evidence-based verdict for every active thread. Your opinion comes from the code, not from the diff hunk or the comment text.

## ANALYSIS MINDSET

Review bots (CodeRabbit, SonarQube, etc.) make frequent mistakes with:
- Idiomatic Rust patterns they don't understand (lifetimes, ownership, error propagation with `?`)
- TypeScript strict mode with Zod — they confuse inferred types with incorrect types
- Project conventions that aren't in the diff but are present in surrounding code
- Code that looks wrong in the diff but is protected upstream

Be extremely skeptical. The burden of proof is on the comment — if you cannot confirm the claim with real code, it's a FALSE_POSITIVE.

## SEQUENCE

### 1. Load Project Context

Before analyzing any thread, read:
- `{project-root}/CLAUDE.md` — vision, stack, conventions, auth architecture
- `{project-root}/apps/server/CLAUDE.md` — Rust conventions, error patterns, ingestion
- `{project-root}/packages/client/CLAUDE.md` — TypeScript conventions, testing
- `{project-root}/apps/webview-ui/CLAUDE.md` — Next.js conventions

If any thread touches ingestion endpoints, grouping logic, or the Sentry protocol, also read:
- `{project-root}/docs/ingestion-flow.md`
- `{project-root}/docs/api-design.md`
- `{project-root}/docs/grouping-algorithm.md`

This context is your authority reference for deciding what is an intentional convention vs a real error.

### 2. Analyze Each Thread

Process `active_threads` one by one. For each:

#### a. Read the Real Code

**If the thread has `path`:** read the full file or at least ±50 lines around `line`. Also read `diff_hunk` as additional context — never as the sole source.

**For Rust files** (`apps/server/`): understand the return type, implemented traits, error handling, and whether `#[allow(...)]` indicates a conscious decision.

**For TypeScript files** (`packages/client/`, `apps/webview-ui/`): understand inferred types, Zod schemas, and whether the code is covered by tests.

#### b. Understand the Claim

Extract:
- `comment_claim` — what the reviewer asserts (one sentence, max 60 chars)
- `comment_type` — one of: `style` | `logic` | `security` | `performance` | `typing` | `test` | `docs` | `unsafe` | `api-contract`

#### c. Investigate Thoroughly

Before issuing a verdict, verify:

1. Is the claim technically accurate at the referenced location?
2. Does the same pattern exist elsewhere in the project? (grep/glob) — if it's a recurring pattern, it's likely an intentional convention.
3. Is the concern already handled? (upstream validation, error handling in the caller, Actix framework guarantees, Zod type that prevents the case)
4. Is this a conscious decision documented in CLAUDE.md or in nearby comments?
5. Is `comment_type` `unsafe` or `security`? If so, investigate deeper — the bar for FALSE_POSITIVE is higher here.
6. Is the bot flagging something idiomatic in Rust/TypeScript that it simply doesn't know? (e.g., `unwrap()` in initialization code, `expect()` with a clear message, `async_trait`, `impl Trait` in return position)

#### d. Verdict

**`REAL`** — the claim is accurate AND the issue causes or could cause: incorrect behavior, data corruption, security vulnerability, runtime panic, or unhandled error. AND it is NOT mitigated by another mechanism in the codebase.

**`FALSE_POSITIVE`** — the claim is inaccurate, already handled, contradicts an established project convention, is a different style with no functional impact, or the bot does not understand the language/framework idiom.

Store per thread:
```
{
  thread_id, index, author_login, is_bot,
  path, line, comment_claim, comment_type,
  verdict: "REAL" | "FALSE_POSITIVE",
  evidence,       // 1-2 sentences citing specific code with line reference
  fix_approach,   // REAL only: brief proposed fix (max 60 chars)
  fp_explanation  // FALSE_POSITIVE only: why no change is needed (max 60 chars)
}
```

Add to `analysis_results`.

### 3. Analyze General Reviews

For each entry in `active_reviews`: read the body, extract concrete concerns, apply the same verdict logic. Store in `analysis_results` with `path: null`.

### 4. Compute Stats and Proceed

Compute: `total_analyzed`, `count_real`, `count_fp`.

Load and execute `{nextStep}`.
