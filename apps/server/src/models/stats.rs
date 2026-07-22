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

/// The at-a-glance aggregates one row of the project-list table needs.
///
/// Deliberately narrower than [`ProjectStatsSummary`]: that one answers "how
/// is this project doing" for a page dedicated to a single project, this one
/// answers "which of my projects should I look at first" and must stay cheap
/// enough to compute for every project on the page at once.
#[derive(Debug, Serialize, PartialEq, Eq)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ProjectListStats {
    /// Distinct issues that received at least one event in each bucket, oldest
    /// first. Always `LIST_TREND_BUCKETS` long so the sparkline column renders
    /// at a constant width whatever window was asked for.
    ///
    /// Counts issues *active* in the bucket rather than issues *created* in
    /// it. Creations are far too sparse to draw: a quiet self-hosted project
    /// opens a handful of issues a day, which over 24 hourly buckets is three
    /// lone bars in a field of zeros. Deliberately not summable — an issue
    /// firing all day is counted in every bucket it appears in, so the series
    /// is a shape, not a total.
    pub trend: Vec<i64>,
    /// Error events in the window, against the window before it.
    pub events: MetricDelta,
    /// Issues whose `first_seen` falls in the window, against the window
    /// before it. Drives the "issues are climbing" signal, which event volume
    /// cannot give: one noisy issue can multiply events without anything new
    /// having broken.
    pub new_issues: MetricDelta,
    /// Issues currently unresolved, regardless of window.
    pub open_issues: i64,
    /// The subset of `open_issues` at `fatal` level.
    pub fatal_issues: i64,
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
