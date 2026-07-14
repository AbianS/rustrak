//! Unit tests for `RUSTRAK_LOG_TIMEZONE` log-timestamp handling.
//!
//! Scope: log formatting only. Does not touch event/issue timestamps (those stay
//! UTC in storage and the API regardless of this setting).

use chrono::{TimeZone, Utc};
use chrono_tz::Tz;
use rustrak::logging::{format_log_timestamp, resolve_log_timezone};
use serial_test::serial;

#[test]
#[serial]
fn test_resolve_log_timezone_unset_returns_none() {
    std::env::remove_var("RUSTRAK_LOG_TIMEZONE");

    assert_eq!(resolve_log_timezone(), None);
}

#[test]
#[serial]
fn test_resolve_log_timezone_valid_iana_name_returns_tz() {
    std::env::set_var("RUSTRAK_LOG_TIMEZONE", "Asia/Shanghai");

    assert_eq!(resolve_log_timezone(), Some(Tz::Asia__Shanghai));

    std::env::remove_var("RUSTRAK_LOG_TIMEZONE");
}

#[test]
fn test_format_log_timestamp_none_produces_utc_rfc3339() {
    let instant = Utc.with_ymd_and_hms(2026, 7, 14, 4, 30, 0).unwrap();

    let formatted = format_log_timestamp(instant, None);

    assert_eq!(formatted, "2026-07-14T04:30:00Z");
}

#[test]
fn test_format_log_timestamp_applies_zone_offset() {
    // 2026-07-14T04:30:00Z is the exact example from GH issue #179.
    let instant = Utc.with_ymd_and_hms(2026, 7, 14, 4, 30, 0).unwrap();

    let formatted = format_log_timestamp(instant, Some(Tz::Asia__Shanghai));

    // Asia/Shanghai is a fixed UTC+8 offset (no DST) — matches the issue's own
    // "Configured" example exactly.
    assert_eq!(formatted, "2026-07-14T12:30:00+08:00");
}

#[test]
#[serial]
fn test_resolve_log_timezone_invalid_name_returns_none() {
    std::env::set_var("RUSTRAK_LOG_TIMEZONE", "Not/AZone");

    assert_eq!(resolve_log_timezone(), None);

    std::env::remove_var("RUSTRAK_LOG_TIMEZONE");
}
