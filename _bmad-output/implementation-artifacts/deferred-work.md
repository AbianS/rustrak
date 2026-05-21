# Deferred Work

Append-only log of deferred findings surfaced during reviews.

---

## 2026-05-21 — from spec-dsn-public-url review

**Source:** 3-reviewer adversarial review (blind hunter + edge case hunter + acceptance auditor)

### D-1: HOST=0.0.0.0 fallback produces unroutable DSN (medium)
When `PUBLIC_URL` is unset and `HOST=0.0.0.0` (default), the fallback DSN is `http://0.0.0.0:8080/...` — unreachable from outside the host. Consider logging a warning at startup when `HOST=0.0.0.0` and `PUBLIC_URL` is unset, or substituting `localhost` in the fallback for display purposes. Pre-existing behavior; out of scope for the fix.

### D-2: PUBLIC_URL without scheme silently produces wrong DSN (medium)
If a user sets `PUBLIC_URL=api.example.com` (forgetting the scheme), no error is raised. The `dsn()` method defaults to `http://` scheme. Consider validating at startup with `url::Url::parse` and surfacing a clear error. Deferred to avoid adding `url` crate dependency to core config.

### D-3: Sub-path PUBLIC_URL produces malformed DSN (medium)
`PUBLIC_URL=https://example.com/rustrak` causes `dsn()` to produce `https://key@example.com/rustrak/2` — Sentry SDKs parse `/rustrak` as the project ID. Sub-path deployments are not supported by the Sentry DSN format. Should be documented explicitly.

### D-4: Case-sensitive scheme detection in dsn() (low)
`Project::dsn()` uses `base_url.starts_with("https")` — `HTTPS://api.example.com` would silently produce an `http://` DSN. Consider normalizing to lowercase at Config load time alongside the whitespace/trailing-slash cleanup.

### D-5: No end-to-end test for PUBLIC_URL → Config → build_base_url → dsn() pipeline (low)
Unit tests cover each function in isolation. No integration/e2e test verifies that a `PUBLIC_URL` env var round-trips to the `dsn` field in a real API response. Add an integration test to `tests/integration/projects_api_test.rs` when the integration test suite supports env var injection.
