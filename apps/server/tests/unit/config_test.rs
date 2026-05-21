//! Unit tests for configuration parsing
//!
//! Tests environment variable parsing and default values.
//!
//! Note: These tests modify global environment variables and must run serially.

use rustrak::config::{Config, RateLimitConfig};
use serial_test::serial;

// =============================================================================
// Rate Limit Config Tests
// =============================================================================

#[test]
#[serial]
fn test_rate_limit_config_defaults() {
    // Clear any env vars that might affect this test
    std::env::remove_var("MAX_EVENTS_PER_MINUTE");
    std::env::remove_var("MAX_EVENTS_PER_HOUR");
    std::env::remove_var("MAX_EVENTS_PER_PROJECT_PER_MINUTE");
    std::env::remove_var("MAX_EVENTS_PER_PROJECT_PER_HOUR");

    let config = RateLimitConfig::from_env();

    assert_eq!(config.max_events_per_minute, 1000);
    assert_eq!(config.max_events_per_hour, 10000);
    assert_eq!(config.max_events_per_project_per_minute, 500);
    assert_eq!(config.max_events_per_project_per_hour, 5000);
}

#[test]
#[serial]
fn test_rate_limit_config_custom_values() {
    // Set custom values
    std::env::set_var("MAX_EVENTS_PER_MINUTE", "100");
    std::env::set_var("MAX_EVENTS_PER_HOUR", "1000");
    std::env::set_var("MAX_EVENTS_PER_PROJECT_PER_MINUTE", "50");
    std::env::set_var("MAX_EVENTS_PER_PROJECT_PER_HOUR", "500");

    let config = RateLimitConfig::from_env();

    assert_eq!(config.max_events_per_minute, 100);
    assert_eq!(config.max_events_per_hour, 1000);
    assert_eq!(config.max_events_per_project_per_minute, 50);
    assert_eq!(config.max_events_per_project_per_hour, 500);

    // Clean up
    std::env::remove_var("MAX_EVENTS_PER_MINUTE");
    std::env::remove_var("MAX_EVENTS_PER_HOUR");
    std::env::remove_var("MAX_EVENTS_PER_PROJECT_PER_MINUTE");
    std::env::remove_var("MAX_EVENTS_PER_PROJECT_PER_HOUR");
}

#[test]
#[serial]
fn test_rate_limit_config_invalid_values_use_defaults() {
    // Set invalid (non-numeric) values
    std::env::set_var("MAX_EVENTS_PER_MINUTE", "not-a-number");
    std::env::set_var("MAX_EVENTS_PER_HOUR", "abc");

    let config = RateLimitConfig::from_env();

    // Should fall back to defaults
    assert_eq!(config.max_events_per_minute, 1000);
    assert_eq!(config.max_events_per_hour, 10000);

    // Clean up
    std::env::remove_var("MAX_EVENTS_PER_MINUTE");
    std::env::remove_var("MAX_EVENTS_PER_HOUR");
}

#[test]
#[serial]
fn test_rate_limit_config_zero_values() {
    std::env::set_var("MAX_EVENTS_PER_MINUTE", "0");
    std::env::set_var("MAX_EVENTS_PER_HOUR", "0");

    let config = RateLimitConfig::from_env();

    // Zero is a valid value (effectively disables rate limiting)
    assert_eq!(config.max_events_per_minute, 0);
    assert_eq!(config.max_events_per_hour, 0);

    // Clean up
    std::env::remove_var("MAX_EVENTS_PER_MINUTE");
    std::env::remove_var("MAX_EVENTS_PER_HOUR");
}

#[test]
#[serial]
fn test_rate_limit_config_negative_values() {
    std::env::set_var("MAX_EVENTS_PER_MINUTE", "-100");

    let config = RateLimitConfig::from_env();

    // Negative values are technically valid i64
    assert_eq!(config.max_events_per_minute, -100);

    // Clean up
    std::env::remove_var("MAX_EVENTS_PER_MINUTE");
}

// =============================================================================
// PUBLIC_URL Config Tests
// =============================================================================

#[test]
#[serial]
fn test_config_public_url_none_when_not_set() {
    let saved_db = std::env::var("DATABASE_URL").ok();
    std::env::remove_var("PUBLIC_URL");
    std::env::set_var("DATABASE_URL", "postgres://test:test@localhost/test");

    let config = Config::from_env().expect("Config::from_env() should succeed");
    assert!(config.public_url.is_none());

    std::env::remove_var("DATABASE_URL");
    if let Some(v) = saved_db { std::env::set_var("DATABASE_URL", v); }
}

#[test]
#[serial]
fn test_config_public_url_loaded_from_env() {
    let saved_db = std::env::var("DATABASE_URL").ok();
    std::env::set_var("PUBLIC_URL", "https://api.example.com");
    std::env::set_var("DATABASE_URL", "postgres://test:test@localhost/test");

    let config = Config::from_env().expect("Config::from_env() should succeed");
    assert_eq!(
        config.public_url,
        Some("https://api.example.com".to_string())
    );

    std::env::remove_var("PUBLIC_URL");
    std::env::remove_var("DATABASE_URL");
    if let Some(v) = saved_db { std::env::set_var("DATABASE_URL", v); }
}

#[test]
#[serial]
fn test_config_public_url_strips_trailing_slash() {
    let saved_db = std::env::var("DATABASE_URL").ok();
    std::env::set_var("PUBLIC_URL", "https://api.example.com/");
    std::env::set_var("DATABASE_URL", "postgres://test:test@localhost/test");

    let config = Config::from_env().expect("Config::from_env() should succeed");
    assert_eq!(
        config.public_url,
        Some("https://api.example.com".to_string())
    );

    std::env::remove_var("PUBLIC_URL");
    std::env::remove_var("DATABASE_URL");
    if let Some(v) = saved_db { std::env::set_var("DATABASE_URL", v); }
}

#[test]
#[serial]
fn test_config_public_url_empty_string_treated_as_none() {
    let saved_db = std::env::var("DATABASE_URL").ok();
    std::env::set_var("PUBLIC_URL", "");
    std::env::set_var("DATABASE_URL", "postgres://test:test@localhost/test");

    let config = Config::from_env().expect("Config::from_env() should succeed");
    assert!(config.public_url.is_none());

    std::env::remove_var("PUBLIC_URL");
    std::env::remove_var("DATABASE_URL");
    if let Some(v) = saved_db { std::env::set_var("DATABASE_URL", v); }
}
