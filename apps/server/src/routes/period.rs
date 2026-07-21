//! Shared parsing for the `?period=` query parameter.
//!
//! Several read-only endpoints (session health, project stats) accept the same
//! relative time window. Keeping one parser means they cannot drift on what
//! they accept or on the clamp that protects the query planner.

/// Parse a period string ("24h", "7d", or a bare integer of hours) into hours,
/// clamped to 1 hour – 90 days.
pub fn parse_period_hours(period: Option<&str>) -> Option<i64> {
    period
        .and_then(|p| {
            // Accept "24h", "48h", "7d", or bare integers (treated as hours).
            if let Some(stripped) = p.strip_suffix('h') {
                stripped.parse::<i64>().ok()
            } else if let Some(stripped) = p.strip_suffix('d') {
                stripped.parse::<i64>().ok().and_then(|d| d.checked_mul(24))
            } else {
                p.parse::<i64>().ok()
            }
        })
        // Clamp to 1 hour – 90 days to prevent negative intervals and table scans
        .map(|h| h.clamp(1, 90 * 24))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_hour_suffix() {
        assert_eq!(parse_period_hours(Some("24h")), Some(24));
    }

    #[test]
    fn parses_day_suffix() {
        assert_eq!(parse_period_hours(Some("7d")), Some(168));
    }

    #[test]
    fn parses_bare_integer_as_hours() {
        assert_eq!(parse_period_hours(Some("12")), Some(12));
    }

    #[test]
    fn absent_period_means_all_time() {
        assert_eq!(parse_period_hours(None), None);
    }

    #[test]
    fn unparseable_period_means_all_time() {
        assert_eq!(parse_period_hours(Some("last tuesday")), None);
    }

    #[test]
    fn clamps_below_one_hour() {
        // A zero or negative window would produce an empty or inverted range.
        assert_eq!(parse_period_hours(Some("0h")), Some(1));
        assert_eq!(parse_period_hours(Some("-5d")), Some(1));
    }

    #[test]
    fn clamps_above_ninety_days() {
        assert_eq!(parse_period_hours(Some("365d")), Some(90 * 24));
    }

    #[test]
    fn day_overflow_does_not_panic() {
        assert_eq!(parse_period_hours(Some("9223372036854775807d")), None);
    }
}
