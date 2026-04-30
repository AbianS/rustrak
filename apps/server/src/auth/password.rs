//! Password validation module
//!
//! Provides password strength validation for registration and password changes.

/// Common passwords that should be rejected (top 100 most common)
const COMMON_PASSWORDS: &[&str] = &[
    "password", "123456", "12345678", "qwerty", "abc123", "monkey", "1234567",
    "letmein", "trustno1", "dragon", "baseball", "iloveyou", "master", "sunshine",
    "ashley", "bailey", "passw0rd", "shadow", "123123", "654321", "superman",
    "qazwsx", "michael", "football", "password1", "password123", "batman", "login",
    "admin", "admin123", "welcome", "welcome1", "p@ssw0rd", "qwerty123", "solo",
    "princess", "starwars", "cheese", "tigger", "whatever", "fuckyou", "donald",
    "pokemon", "soccer", "access", "mustang", "pepper", "joshua", "jennifer",
    "george", "houston", "rangers", "matrix", "biteme", "killer", "charlie",
    "corvette", "summer", "jessica", "robert", "maverick", "harley", "asshole",
    "buster", "andrew", "yellow", "smokey", "jordan", "cowboy", "william",
    "secret", "orange", "cookie", "coffee", "silver", "nicole", "richard",
    "dakota", "martin", "maggie", "guitar", "runner", "jasper", "102030",
    "lakers", "soccer1", "winter", "bonnie", "hockey", "merlin", "diamond",
    "forever", "angels", "ginger", "hammer", "banana", "purple", "prince",
    "flower", "hunter",
];

/// Password strength validation
///
/// Requirements:
/// - Minimum 8 characters
/// - At least one uppercase letter
/// - At least one lowercase letter
/// - At least one digit
/// - Not a commonly used password
///
/// Returns `Ok(())` if password meets all requirements,
/// or `Err(Vec<String>)` with a list of validation error messages.
pub fn validate_password_strength(password: &str) -> Result<(), Vec<String>> {
    let mut errors = Vec::new();

    // Length check
    if password.len() < 8 {
        errors.push("Password must be at least 8 characters long".to_string());
    }

    // Uppercase check
    if !password.chars().any(|c| c.is_ascii_uppercase()) {
        errors.push("Password must contain at least one uppercase letter".to_string());
    }

    // Lowercase check
    if !password.chars().any(|c| c.is_ascii_lowercase()) {
        errors.push("Password must contain at least one lowercase letter".to_string());
    }

    // Digit check
    if !password.chars().any(|c| c.is_ascii_digit()) {
        errors.push("Password must contain at least one digit".to_string());
    }

    // Common password check (case-insensitive)
    let password_lower = password.to_lowercase();
    if COMMON_PASSWORDS.contains(&password_lower.as_str()) {
        errors.push("Password is too common, please choose a more unique password".to_string());
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_password() {
        assert!(validate_password_strength("SecureP@ss1").is_ok());
        assert!(validate_password_strength("MyStr0ngPwd").is_ok());
        assert!(validate_password_strength("Test1234A").is_ok());
    }

    #[test]
    fn test_too_short() {
        let result = validate_password_strength("Short1A");
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.iter().any(|e| e.contains("at least 8 characters")));
    }

    #[test]
    fn test_missing_uppercase() {
        let result = validate_password_strength("lowercase123");
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.iter().any(|e| e.contains("uppercase letter")));
    }

    #[test]
    fn test_missing_lowercase() {
        let result = validate_password_strength("UPPERCASE123");
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.iter().any(|e| e.contains("lowercase letter")));
    }

    #[test]
    fn test_missing_digit() {
        let result = validate_password_strength("NoDigitsHere");
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.iter().any(|e| e.contains("digit")));
    }

    #[test]
    fn test_common_password() {
        let result = validate_password_strength("Password1");
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.iter().any(|e| e.contains("too common")));
    }

    #[test]
    fn test_common_password_case_insensitive() {
        // "password" is in the list, "PASSWORD1" should also be rejected
        let result = validate_password_strength("PASSWORD1");
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.iter().any(|e| e.contains("too common")));
    }

    #[test]
    fn test_multiple_errors() {
        // "a" fails all requirements
        let result = validate_password_strength("a");
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.len() >= 3); // at least: too short, no uppercase, no digit
    }

    #[test]
    fn test_exact_minimum_length() {
        // Exactly 8 characters with all requirements met
        assert!(validate_password_strength("Abcdefg1").is_ok());
    }

    #[test]
    fn test_unicode_does_not_count() {
        // Unicode characters don't satisfy ASCII requirements
        let result = validate_password_strength("pässwörd123");
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.iter().any(|e| e.contains("uppercase letter")));
    }

    #[test]
    fn test_various_common_passwords() {
        // Test several common passwords as-is (they may fail other checks too)
        for &common in &["password", "qwerty", "admin", "letmein", "dragon"] {
            let result = validate_password_strength(common);
            assert!(
                result.is_err(),
                "Password '{}' should be rejected",
                common
            );
            // Specifically check that the common password error is present
            let errors = result.unwrap_err();
            assert!(
                errors.iter().any(|e| e.contains("too common")),
                "Password '{}' should be flagged as too common, errors: {:?}",
                common,
                errors
            );
        }
    }
}
