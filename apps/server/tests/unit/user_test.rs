//! Unit tests for User model security properties (H-1: timing oracle)

use rustrak::models::User;

// =============================================================================
// Timing Oracle Prevention Tests (H-1)
// =============================================================================

#[test]
fn test_dummy_password_verify_always_returns_false() {
    // Must never grant access — runs Argon2 to equalize timing with real verify
    assert!(!User::run_dummy_password_verify("anypassword"));
}

#[test]
fn test_dummy_password_verify_with_empty_password() {
    assert!(!User::run_dummy_password_verify(""));
}

#[test]
fn test_dummy_password_verify_with_long_password() {
    let long_password = "a".repeat(1024);
    assert!(!User::run_dummy_password_verify(&long_password));
}
