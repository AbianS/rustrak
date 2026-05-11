# Testing Anti-Patterns in Rust

**Load when:** writing or changing tests, adding trait fakes, or tempted to add test-only methods to production code.

**Core principle:** Test what the code does, not how it does it internally.

## Anti-Pattern 1: Exposing Internals for Tests

```rust
// ❌ Adding pub(crate) / pub only because a test needs it
pub(crate) fn internal_parse_step(data: &[u8]) -> ParseResult { ... }

// ✅ Test through the public interface
// If you can't reach the behavior through the public API,
// either the behavior isn't worth testing or the API is too narrow
#[test]
fn test_parse_envelope_correctly_handles_missing_length() {
    let envelope = b"{\"event_id\":\"abc\"}\n{\"type\":\"event\"}\n{\"msg\":\"hi\"}\n";
    let result = EnvelopeParser::new(envelope).parse().unwrap();
    assert_eq!(result.items[0].payload, b"{\"msg\":\"hi\"}");
}
```

**Gate:** "Did I add `pub` or `pub(crate)` to make a test compile?" If yes → test through the public interface instead, or reconsider the design.

## Anti-Pattern 2: Test-Only Methods in Production Structs

```rust
// ❌ Method only exists for tests
impl DigestWorker {
    pub fn flush_for_testing(&mut self) { ... }
}

// ✅ Test utilities live in test modules or test helpers
// In tests/common/mod.rs or tests/helpers.rs
pub async fn drain_digest_queue(pool: &DbPool) { ... }
```

**Gate:** "Is this method only called from `#[test]` functions?" If yes → move to test utilities, not production code.

## Anti-Pattern 3: Mocking SQLx / DbPool

```rust
// ❌ Mocking the database — misses real query bugs, schema changes, index behavior
struct MockPool;
impl FakeExecutor for MockPool {
    async fn fetch_one(&self, ...) -> Result<PgRow, sqlx::Error> {
        Ok(fake_row()) // This never catches a broken migration
    }
}

// ✅ Use TestDb — real Postgres via testcontainers
#[actix_web::test]
async fn test_create_project() {
    let db = TestDb::new().await;
    let project = ProjectService::create(&db.pool, ...).await.unwrap();
    assert_eq!(project.name, "My Project");
}
```

**Why:** SQLx's compile-time query checking + testcontainers means the real DB is both fast and correct. A mock DB gives false confidence and misses migration bugs. See mocking.md.

## Anti-Pattern 4: Asserting on Hash/ID Values

```rust
// ❌ Fragile: breaks if hash algorithm changes, even if behavior doesn't
#[test]
fn test_grouping_hash() {
    assert_eq!(
        hash_grouping_key("TypeError: x ⋄ /api"),
        "3f2e1a..." // hardcoded SHA256
    );
}

// ✅ Test the behavior properties, not the artifact
#[test]
fn test_grouping_hash_is_deterministic_and_unique() {
    let h1 = hash_grouping_key("TypeError: x ⋄ /api");
    let h2 = hash_grouping_key("TypeError: x ⋄ /api");
    let h3 = hash_grouping_key("ValueError: y ⋄ /api");
    assert_eq!(h1, h2);         // deterministic
    assert_ne!(h1, h3);         // unique per input
    assert_eq!(h1.len(), 64);   // SHA256 hex length — structural contract
}
```

## Anti-Pattern 5: Over-Setup Integration Tests

```rust
// ❌ Building up a full application just to test one endpoint behavior
#[actix_web::test]
async fn test_ingest() {
    let db = TestDb::new().await;
    let config = create_full_config_with_all_services();
    let smtp_client = build_smtp_client();
    let notification_service = NotificationService::new(smtp_client, ...);
    let digest_worker = DigestWorker::new(...);
    // 30 more lines of setup...
    
    let app = test::init_service(App::new()
        .service(all_routes())
        .app_data(/* everything */)
    ).await;
}

// ✅ Only wire what the test actually exercises
#[actix_web::test]
async fn test_ingest_returns_200_for_valid_envelope() {
    let db = TestDb::new().await;
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .service(web::scope("/api").service(routes::ingest::handler))
    ).await;
    // test the one thing
}
```

**Gate:** "Does this setup actually affect the behavior I'm testing?" If not → remove it.

## Anti-Pattern 6: Testing Error Messages Verbatim

```rust
// ❌ Brittle: breaks on any rewording of the error message
assert_eq!(result.unwrap_err().to_string(), "invalid envelope: missing header newline at byte 42");

// ✅ Test the error type/variant, not the message string
assert!(matches!(result.unwrap_err(), AppError::InvalidEnvelope(_)));
// Or if you need to check content:
assert!(result.unwrap_err().to_string().contains("missing header"));
```

## Quick Reference

| Anti-Pattern | Fix |
|---|---|
| `pub(crate)` only for tests | Test through public API |
| Test-only methods on production structs | Move to test utilities |
| Mocking `DbPool` / SQLx | Use `TestDb` (testcontainers) |
| Hardcoded hash/ID values | Test behavioral properties |
| 30-line test setup | Only wire what the test touches |
| Assert on exact error message strings | Assert on error variant or partial string |
