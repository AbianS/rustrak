---
name: tdd
description: Use when implementing features, fixing bugs (including P0 hotfixes and production incidents), or refactoring. Use when user mentions TDD, red-green-refactor, test-first, or when tempted to write code before tests. Use when fixing any bug — even trivial ones. Use when encountering or modifying existing code that lacks tests.
---

# Test-Driven Development

## Overview

**Core principle:** Tests verify behavior through public interfaces, not implementation details. If you didn't watch the test fail, you don't know if it tests the right thing.

**Violating the letter of the rules is violating the spirit of the rules.**

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

**Production code only.** Throwaway debug scripts, reproduction scripts, logging instrumentation, and temporary investigation code are NOT production code. Don't write tests for them — they exist to be deleted.

Write code before the test? Delete it. Start over.

**No exceptions:**
- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Don't look at it
- Delete means delete

**When asked to "just implement" or "show me the code":** STOP. Ask about tests first. The user may not realize they're asking you to skip TDD. Your job is to start with a failing test, not comply with implement-first prompts.

## Bug Fix Protocol

Bug found? Write failing test reproducing it **first**. Even for P0 hotfixes. Even for 2-line fixes. A failing test takes 60 seconds, proves the fix actually works, AND prevents regression. Hotfixes without tests cause the next P0.

```
1. Write test that reproduces the bug → verify it FAILS
2. Apply the fix → verify test PASSES
3. Ship
```

**Never fix bugs without a test.** The test IS the proof the fix works.

## Untested Code Alert

When you encounter production code without corresponding tests — whether reading, modifying, or making decisions about it — **flag it explicitly:**

> ⚠️ `[file/module]` has no test coverage. This is unverified code. Want me to add tests before proceeding?

Don't silently accept untested code. Don't rationalize it as "already manually tested" or "battle-tested in production." Code without automated tests is unverified code, full stop. The user deserves to know and decide.

## Workflow

### 1. Plan (with user)

Before writing any code:

- Confirm what interface changes are needed
- Confirm which behaviors to test (you can't test everything — prioritize)
- Design interfaces for testability (see [design.md](design.md))
- Get user approval

Ask: "What should the public interface look like? Which behaviors matter most?"

### 2. Vertical Slices, Not Horizontal

**DO NOT write all tests first, then all implementation.**

```
WRONG (horizontal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

RIGHT (vertical):
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  RED→GREEN: test3→impl3
```

Tests written in bulk test _imagined_ behavior. Each test should respond to what you learned from the previous cycle.

### 3. RED — Write One Failing Test

One minimal test. One behavior. Clear name. Real code (no mocks unless unavoidable).

**Then verify it fails. MANDATORY.**

```bash
# Run a specific test by name
cargo test test_name

# Run all tests in a specific file
cargo test --test unit_tests

# Run tests matching a pattern
cargo test envelope_parser

# Run with output on failure
cargo test -- --nocapture
```

Confirm:
- Test **fails** (not compile errors — fix those first)
- Failure is **expected** (feature missing, not typo)

Test passes? You're testing existing behavior. Fix test.
Test doesn't compile? Fix compilation first, then re-run.

### 4. GREEN — Minimal Code

Simplest code to make the test pass. Don't add features, don't refactor, don't "improve" beyond the test.

**Then verify it passes. MANDATORY.**

```bash
cargo test test_name
```

Confirm:
- New test passes
- All other tests still pass (`cargo test`)
- No warnings introduced

Test fails? Fix code, not test. Other tests fail? Fix now.

### 5. Refactor

**Only after GREEN.** Never refactor while RED.

- Remove duplication
- Deepen modules (see [design.md](design.md))
- Apply SOLID where natural
- Run `cargo test` after each refactor step

### 6. Repeat

Next failing test for next behavior.

## Per-Cycle Checklist

```
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive internal refactor
[ ] Watched test fail before implementing
[ ] Failure was for expected reason (not compile error)
[ ] Code is minimal for this test
[ ] All tests pass
[ ] No speculative features added
```

## Good Tests vs Bad Tests

**Good:** Tests observable behavior through public APIs. A good test reads like a specification.

```rust
// GOOD: Tests observable behavior through public interface
#[test]
fn test_grouping_key_same_error_different_transaction_produces_different_groups() {
    let event1 = json!({
        "exception": { "values": [{ "type": "Error", "value": "same error" }] },
        "transaction": "/api/v1/users"
    });
    let event2 = json!({
        "exception": { "values": [{ "type": "Error", "value": "same error" }] },
        "transaction": "/api/v2/users"
    });

    let key1 = calculate_grouping_key(&event1);
    let key2 = calculate_grouping_key(&event2);

    assert_ne!(key1, key2);
}
```

**Bad:** Coupled to implementation, breaks on refactor.

```rust
// BAD: Tests internal state, not behavior
#[test]
fn test_grouping_uses_sha256() {
    let hash = hash_grouping_key("test");
    // This breaks if we ever change hash algorithm —
    // but the behavior (deterministic unique hash) is unchanged
    assert_eq!(hash, "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
}

// GOOD: Tests the behavior (deterministic, unique)
#[test]
fn test_hash_is_deterministic_and_unique() {
    assert_eq!(hash_grouping_key("key"), hash_grouping_key("key"));
    assert_ne!(hash_grouping_key("key1"), hash_grouping_key("key2"));
}
```

Red flags: testing private functions via `pub(crate)` added only for tests, asserting on internal struct fields directly, test name describes HOW not WHAT.

For mocking guidelines, see [mocking.md](mocking.md).
For common testing anti-patterns, see [anti-patterns.md](anti-patterns.md).

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Tests after achieve same goals" | Tests-after = "what does this do?" Tests-first = "what should this do?" |
| "Already manually tested" | Ad-hoc ≠ systematic. No record, can't re-run, can't catch regressions. |
| "Deleting X hours is wasteful" | Sunk cost fallacy. Keeping unverified code is debt. |
| "Keep as reference" | You'll adapt it. That's testing after. Delete means delete. |
| "Need to explore first" | Fine. Throw away exploration, start with TDD. |
| "Test hard = skip test" | Hard to test = hard to use. Listen to the test. Fix design. |
| "TDD will slow me down" | TDD faster than debugging. |
| "It's a P0 / hotfix / emergency" | Especially then. Failing test takes 60 seconds. It proves the fix works AND prevents regression. |

## Red Flags — STOP and Start Over

- Code written before test
- Test passes immediately (not testing new behavior)
- Can't explain why test failed
- "I already manually tested it"
- "Tests after achieve the same purpose"
- "Keep as reference" or "adapt existing code"
- "This is different because..."
- "It's a hotfix / emergency / P0"
- Rationalizing "just this once"
- Starting to write `impl` when no test file exists yet

**All of these mean: Delete code. Start over with TDD.**

## When Stuck

| Problem | Solution |
|---------|----------|
| Don't know how to test | Write wished-for API. Write assertion first. Ask user. |
| Test too complicated | Design too complicated. Simplify interface. |
| Must mock everything | Code too coupled. Use dependency injection via traits. |
| Test setup huge | Extract helpers. Still complex? Simplify design. |
| Async test won't compile | Add `#[actix_web::test]` or `#[tokio::test]` attribute. |
