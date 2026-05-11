# Design for Testability in Rust

## Deep Modules

Small interface + deep implementation. Hide complexity behind simple APIs.

```
Deep (good):          Shallow (avoid):
┌──────────┐          ┌──────────────────┐
│ Small API│          │    Large API     │
├──────────┤          ├──────────────────┤
│          │          │ Thin impl        │
│ Deep impl│          └──────────────────┘
│          │
└──────────┘
```

Ask: Can I reduce public functions? Simplify parameters? Hide more inside?

## Interface Design

1. **Accept dependencies, don't create them** — enables testing via trait injection
2. **Return `Result`, don't panic** — enables assertion on error paths
3. **Pure functions where possible** — no setup needed, test directly
4. **Small surface area** — fewer `pub` functions = fewer tests = simpler setup

```rust
// ✅ Testable: accepts dep via trait, returns Result
fn process_event(
    event: &Value,
    notifier: &dyn NotificationSender,
) -> Result<ProcessedEvent, AppError> {}

// ❌ Hard to test: creates dep internally, may panic
fn process_event(event: &Value) -> ProcessedEvent {
    let notifier = SlackNotifier::new(std::env::var("SLACK_URL").unwrap());
    notifier.send(event);
    // ...
}
```

## Prefer Pure Functions

Pure functions are the easiest thing to test — no setup, no teardown, no async.

```rust
// Pure: same input → same output, no side effects
// tests/unit/grouping_test.rs already shows this pattern
pub fn calculate_grouping_key(event: &Value) -> String { ... }
pub fn hash_grouping_key(key: &str) -> String { ... }

// Test: zero infrastructure
#[test]
fn test_grouping_key_with_exception() {
    let event = json!({ "exception": { "values": [{ "type": "TypeError", "value": "x" }] } });
    assert!(calculate_grouping_key(&event).contains("TypeError"));
}
```

When a function needs an external resource to work, ask: can the pure logic be extracted separately?

## Dependency Injection via Traits

For boundaries that can't be pure (DB, HTTP, time), inject via trait objects.

```rust
// Define the boundary as a trait
#[async_trait]
pub trait EventStore: Send + Sync {
    async fn save(&self, event: &IngestedEvent) -> Result<i64, AppError>;
    async fn find_by_id(&self, id: i64) -> Result<Option<StoredEvent>, AppError>;
}

// Production: real implementation
pub struct SqlEventStore {
    pool: DbPool,
}

// Tests: use real TestDb (preferred) or a fake if speed matters
struct FakeEventStore {
    events: Arc<Mutex<Vec<IngestedEvent>>>,
}
```

For Rustrak's DB layer, **always prefer `TestDb` over fakes** — SQLx query macros are compile-time checked and testcontainers is fast enough.

## Refactoring Candidates

After the TDD cycle, look for:

- **Duplication** → extract function or helper struct
- **Long functions** → break into private helpers (keep tests on the public interface)
- **Shallow modules** → combine or deepen
- **Feature envy** → move logic to where the data lives
- **Hidden time/randomness** → surface as parameter
- **Stringly-typed data** → introduce a newtype or enum

## Test Module Placement

Rustrak separates tests from source (`tests/` directory). Keep this pattern:

```
tests/
├── unit/               # Pure function tests — no DB, no async (mostly)
│   ├── grouping_test.rs
│   ├── envelope_parser_test.rs
│   └── ...
├── integration/        # Tests with real DB via TestDb (actix_web::test)
│   ├── ingest_test.rs
│   ├── auth_test.rs
│   └── ...
└── e2e_tests.rs        # Tests with real Sentry SDK sending envelopes
```

Rule of thumb: if it doesn't touch the DB or network, it belongs in `unit/`. If it does, it belongs in `integration/`.
