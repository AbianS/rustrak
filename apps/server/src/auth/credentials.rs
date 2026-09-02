use std::sync::LazyLock;

use crate::error::AppError;
use crate::models::User;

/// Verified against when there is no account, so a miss costs what a real
/// check costs. Built once: hashing is expensive by design.
static ABSENT_ACCOUNT_HASH: LazyLock<String> = LazyLock::new(|| {
    User::hash_password("a password no account has")
        .expect("hashing a constant with the default parameters cannot fail")
});

/// Is this the password for this account?
///
/// Every failure (no such account, disabled, wrong password) runs one
/// Argon2 verification, so a stopwatch cannot tell them apart. That is why
/// this takes an `Option`, and why `is_active` is read after the verification
/// rather than before it.
pub fn authenticate(user: Option<&User>, password: &str) -> Result<bool, AppError> {
    let Some(user) = user else {
        verify_against(&ABSENT_ACCOUNT_HASH, password)?;
        return Ok(false);
    };

    let matches = user.verify_password(password)?;

    Ok(matches && user.is_active)
}

fn verify_against(hash: &str, password: &str) -> Result<bool, AppError> {
    use argon2::password_hash::{PasswordHash, PasswordVerifier};
    use argon2::Argon2;

    let parsed = PasswordHash::new(hash)
        .map_err(|e| AppError::Internal(format!("Invalid password hash: {}", e)))?;

    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}
