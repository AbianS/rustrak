//! Unit tests for the login credential check.

use rustrak::auth::authenticate;
use rustrak::models::User;
use std::time::{Duration, Instant};

fn user_with(password: &str, is_active: bool) -> User {
    User {
        id: 1,
        email: "marta@acme.com".to_string(),
        password_hash: User::hash_password(password).expect("hashing a password"),
        role: "member".to_string(),
        is_active,
        language: None,
        timezone: None,
        created_at: chrono::Utc::now(),
        last_login: None,
    }
}

/// Median of three: one busy runner should not turn this red.
fn median_time(mut run: impl FnMut()) -> Duration {
    let mut samples: Vec<Duration> = (0..3)
        .map(|_| {
            let start = Instant::now();
            run();
            start.elapsed()
        })
        .collect();
    samples.sort();
    samples[1]
}

#[test]
fn an_address_with_no_account_costs_the_same_as_a_wrong_password() {
    // Was 42ns against 240ms: only the known address reached Argon2. The
    // bound is loose so load cannot turn it red, and still catches that.
    let known = user_with("correct horse", true);

    let present = median_time(|| {
        let _ = authenticate(Some(&known), "wrong password");
    });
    let absent = median_time(|| {
        let _ = authenticate(None, "wrong password");
    });

    assert!(
        absent * 2 >= present,
        "an unknown address answered in {absent:?} where a known one took \
         {present:?}; the gap is an enumeration oracle"
    );
}

#[test]
fn a_disabled_account_costs_the_same_as_an_active_one() {
    // Reading `is_active` first would put a disabled account back on the fast
    // path and leak its existence instead.
    let active = user_with("correct horse", true);
    let disabled = user_with("correct horse", false);

    let active_cost = median_time(|| {
        let _ = authenticate(Some(&active), "wrong password");
    });
    let disabled_cost = median_time(|| {
        let _ = authenticate(Some(&disabled), "wrong password");
    });

    assert!(
        disabled_cost * 2 >= active_cost,
        "a disabled account answered in {disabled_cost:?} where an active one \
         took {active_cost:?}; the gap says the account exists"
    );
}

#[test]
fn the_right_password_on_an_active_account_is_accepted() {
    let user = user_with("correct horse", true);
    assert!(authenticate(Some(&user), "correct horse").expect("verifying"));
}

#[test]
fn the_wrong_password_is_refused() {
    let user = user_with("correct horse", true);
    assert!(!authenticate(Some(&user), "battery staple").expect("verifying"));
}

#[test]
fn a_disabled_account_is_refused_even_with_the_right_password() {
    let user = user_with("correct horse", false);
    assert!(!authenticate(Some(&user), "correct horse").expect("verifying"));
}

#[test]
fn an_address_with_no_account_is_refused() {
    assert!(!authenticate(None, "correct horse").expect("verifying"));
}
