//! Unit tests for monitor schedule math — computing the next expected
//! check-in time from a stored schedule (crontab or interval) + timezone.

use chrono::{TimeZone, Utc};
use rustrak::services::monitor::next_expected_after;

#[test]
fn test_interval_hours_adds_duration() {
    let after = Utc.with_ymd_and_hms(2026, 6, 29, 10, 0, 0).unwrap();
    let next = next_expected_after("interval", "1", Some("hour"), None, after).unwrap();
    assert_eq!(next, Utc.with_ymd_and_hms(2026, 6, 29, 11, 0, 0).unwrap());
}

#[test]
fn test_interval_minutes_adds_duration() {
    let after = Utc.with_ymd_and_hms(2026, 6, 29, 10, 0, 0).unwrap();
    let next = next_expected_after("interval", "5", Some("minute"), None, after).unwrap();
    assert_eq!(next, Utc.with_ymd_and_hms(2026, 6, 29, 10, 5, 0).unwrap());
}

#[test]
fn test_crontab_hourly_next_occurrence() {
    // "0 * * * *" = top of every hour. After 10:30 → 11:00.
    let after = Utc.with_ymd_and_hms(2026, 6, 29, 10, 30, 0).unwrap();
    let next = next_expected_after("crontab", "0 * * * *", None, None, after).unwrap();
    assert_eq!(next, Utc.with_ymd_and_hms(2026, 6, 29, 11, 0, 0).unwrap());
}

#[test]
fn test_crontab_respects_timezone() {
    // Daily at midnight in America/New_York (UTC-4 in June) → 04:00 UTC.
    let after = Utc.with_ymd_and_hms(2026, 6, 29, 10, 0, 0).unwrap();
    let next = next_expected_after(
        "crontab",
        "0 0 * * *",
        None,
        Some("America/New_York"),
        after,
    )
    .unwrap();
    assert_eq!(next, Utc.with_ymd_and_hms(2026, 6, 30, 4, 0, 0).unwrap());
}

#[test]
fn test_invalid_schedule_returns_none() {
    let after = Utc.with_ymd_and_hms(2026, 6, 29, 10, 0, 0).unwrap();
    assert!(next_expected_after("crontab", "not a cron", None, None, after).is_none());
    assert!(next_expected_after("interval", "abc", Some("hour"), None, after).is_none());
}
