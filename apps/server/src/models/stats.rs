use chrono::{DateTime, Utc};
use serde::Serialize;

/// One time-bucketed point in a project's error-event volume, split by severity.
///
/// `total` always equals `fatal + error + warning + info`: `info` absorbs
/// `debug` and any level the SDK sent that we do not model, so the stacked
/// segments of a chart always sum to the bar height and no events silently
/// vanish from the series.
#[derive(Debug, Serialize, PartialEq, Eq)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct EventTimeseriesPoint {
    pub bucket: DateTime<Utc>,
    pub total: i64,
    pub fatal: i64,
    pub error: i64,
    pub warning: i64,
    pub info: i64,
}

/// A counter measured over the requested window alongside the same counter
/// over the window immediately before it.
///
/// `previous` is `None` when the request asked for all time: there is no
/// earlier window to compare against, and reporting `0` there would render as
/// a misleading "+100%" in the UI.
#[derive(Debug, Serialize, PartialEq, Eq)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct MetricDelta {
    pub current: i64,
    pub previous: Option<i64>,
}

impl MetricDelta {
    pub fn new(current: i64, previous: Option<i64>) -> Self {
        Self { current, previous }
    }
}

/// Project-wide counters for the overview page, each with its previous-period
/// comparison.
#[derive(Debug, Serialize, PartialEq, Eq)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ProjectStatsSummary {
    /// The resolved window in hours, or `None` for all time.
    pub period_hours: Option<i64>,
    /// Error events ingested in the window.
    pub events: MetricDelta,
    /// Issues whose `first_seen` falls in the window.
    pub new_issues: MetricDelta,
    /// Issues currently unresolved, regardless of window.
    pub open_issues: i64,
}
