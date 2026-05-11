# When to Mock in Rust

Rust's type system changes the mocking calculus. You rarely need a mocking framework — traits and generics give you seams for free.

## The Hierarchy: Real > Fake > Mock

Prefer in this order:

1. **Real implementation** — unit test pure functions directly (most of Rustrak's logic)
2. **Real DB via testcontainers** — integration tests with actual PostgreSQL (already set up in `tests/integration/`)
3. **Fake implementation** — hand-written struct implementing a trait (fast, no extra crates)
4. **Mock** — only for verifying call sequences, rare

## Mock at System Boundaries Only

| Boundary | Approach |
|---|---|
| PostgreSQL | `TestDb` (testcontainers) for integration tests |
| External HTTP (webhooks, notifications) | Trait injection with a fake impl |
| Time / `chrono::Utc::now()` | Pass timestamp as parameter |
| Randomness / token generation | Pass rng or pre-generated value as parameter |
| File system | `tempfile::TempDir` or pass path as parameter |

**Don't mock:**
- Your own services/modules
- Internal Rustrak logic
- Anything you control

## Trait Injection Pattern

The primary seam for testing in Rustrak. Define a trait, inject it, write a fake for tests.

```rust
// Production trait
trait NotificationSender: Send + Sync {
    async fn send(&self, webhook_url: &str, payload: &Value) -> Result<(), AppError>;
}

// Production implementation
struct ReqwestNotificationSender;

impl NotificationSender for ReqwestNotificationSender {
    async fn send(&self, url: &str, payload: &Value) -> Result<(), AppError> {
        // real reqwest call
    }
}

// Test fake — hand-written, no crate needed
struct FakeNotificationSender {
    calls: Arc<Mutex<Vec<Value>>>,
}

impl NotificationSender for FakeNotificationSender {
    async fn send(&self, _url: &str, payload: &Value) -> Result<(), AppError> {
        self.calls.lock().unwrap().push(payload.clone());
        Ok(())
    }
}

// Test
#[tokio::test]
async fn test_alert_triggers_notification() {
    let sender = Arc::new(FakeNotificationSender { calls: Default::default() });
    let service = AlertService::new(sender.clone());

    service.trigger_alert(&event).await.unwrap();

    let calls = sender.calls.lock().unwrap();
    assert_eq!(calls.len(), 1);
}
```

## Pure Functions Need No Mocking

Rustrak's core logic (grouping, parsing, hashing) is pure. Test directly — no setup needed.

```rust
// No mocks, no DB, no async — just the function
#[test]
fn test_grouping_key_uses_exception_type() {
    let event = json!({ "exception": { "values": [{ "type": "TypeError", "value": "x" }] } });
    let key = calculate_grouping_key(&event);
    assert!(key.contains("TypeError"));
}
```

If a function is hard to test without mocking, it's doing too much. Extract the pure logic.

## Integration Tests: Real DB, Not Mocks

Rustrak uses `testcontainers` to spin up a real PostgreSQL instance. This is intentional — mocking SQLx queries catches nothing useful and misses real query/migration bugs.

```rust
// tests/integration/some_test.rs
#[actix_web::test]
async fn test_create_project_persists() {
    let db = TestDb::new().await;  // real Postgres via testcontainers
    let project = ProjectService::create(&db.pool, CreateProject { name: "Test".into(), slug: None })
        .await
        .unwrap();

    let fetched = ProjectService::get(&db.pool, project.id).await.unwrap();
    assert_eq!(fetched.name, "Test");
}
```

Never mock `DbPool` or `PgPool` — the real thing via `TestDb` is fast enough and actually tests what matters.

## Making Time Testable

Don't call `Utc::now()` deep in logic. Pass the timestamp in.

```rust
// ❌ Hard to test — time is hidden
fn is_token_expired(token: &AuthToken) -> bool {
    token.expires_at < Utc::now()
}

// ✅ Testable — time is a parameter
fn is_token_expired(token: &AuthToken, now: DateTime<Utc>) -> bool {
    token.expires_at < now
}

#[test]
fn test_expired_token_detected() {
    let token = AuthToken { expires_at: Utc::now() - Duration::hours(1), .. };
    assert!(is_token_expired(&token, Utc::now()));
}
```

## When to Reach for `mockall`

Rustrak doesn't use `mockall`. Before adding it, ask:

- Can I extract pure logic and test that instead?
- Can I write a 10-line fake struct?
- Does the test actually need call-count verification?

If all three are no, add `mockall` as a dev-dependency and use `#[automock]`. Otherwise, the fake struct approach is simpler.
