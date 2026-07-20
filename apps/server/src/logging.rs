//! Log timestamp timezone support.
//!
//! Server logs are UTC by default (matches Sentry's own `TIME_ZONE = "UTC"` rule for
//! everything except per-viewer display). `RUSTRAK_LOG_TIMEZONE` lets an operator opt
//! into a display-only conversion for the raw log stream — it never touches event/issue
//! timestamps, which stay UTC in storage and the API regardless of this setting.

use chrono::{DateTime, Utc};
use chrono_tz::Tz;

/// Reads `RUSTRAK_LOG_TIMEZONE` and resolves it to an IANA timezone.
/// Returns `None` if unset, or if set to a name that isn't a recognized IANA zone
/// (falls back to UTC rather than failing startup).
pub fn resolve_log_timezone() -> Option<Tz> {
    std::env::var("RUSTRAK_LOG_TIMEZONE").ok()?.parse().ok()
}

/// Formats a UTC instant as RFC3339, converted to `tz` if given, else UTC (`...Z`).
pub fn format_log_timestamp(instant: DateTime<Utc>, tz: Option<Tz>) -> String {
    match tz {
        Some(tz) => instant
            .with_timezone(&tz)
            .to_rfc3339_opts(chrono::SecondsFormat::Secs, false),
        None => instant.to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
    }
}
