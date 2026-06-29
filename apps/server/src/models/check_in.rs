//! Monitor check-in model (Sentry Crons — Relay's `relay-monitors::CheckIn`).
//!
//! A check-in reports the execution of a scheduled job. SDKs send one at the
//! start (`in_progress`) and one at the end (`ok`/`error`) sharing a
//! `check_in_id`. Schema mirrors `relay-monitors/src/lib.rs`.

use crate::error::{AppError, AppResult};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Status of an incoming check-in. Mirrors Relay's `CheckInStatus`.
///
/// `missed` is never ingested from an SDK — it is computed server-side by the
/// missed-detection worker — so an inbound `missed` is coerced to `unknown`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckInStatus {
    Ok,
    Error,
    InProgress,
    Missed,
    #[serde(other)]
    Unknown,
}

impl CheckInStatus {
    /// The wire/storage string for this status (snake_case, matching Relay).
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Ok => "ok",
            Self::Error => "error",
            Self::InProgress => "in_progress",
            Self::Missed => "missed",
            Self::Unknown => "unknown",
        }
    }
}

/// The monitor schedule. Mirrors Relay's `Schedule` (tagged by `type`).
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Schedule {
    /// A crontab expression, e.g. `"0 * * * *"`.
    Crontab { value: String },
    /// A fixed interval, e.g. every 5 days. `unit` is kept as a string for
    /// forward-compatibility with units this version does not model.
    Interval { value: u64, unit: String },
}

impl Schedule {
    /// Decomposes the schedule into storable columns:
    /// `(schedule_type, schedule_value, schedule_unit)`.
    pub fn to_columns(&self) -> (&'static str, String, Option<String>) {
        match self {
            Schedule::Crontab { value } => ("crontab", value.clone(), None),
            Schedule::Interval { value, unit } => {
                ("interval", value.to_string(), Some(unit.clone()))
            }
        }
    }
}

/// Monitor configuration for upserting the monitor during check-in. Mirrors
/// Relay's `MonitorConfig`.
#[derive(Debug, Clone, Deserialize)]
pub struct MonitorConfig {
    pub schedule: Schedule,
    /// Minutes after the expected time before a check-in counts as missed.
    #[serde(default)]
    pub checkin_margin: Option<i64>,
    /// Minutes an in-progress run may last before it counts as timed out.
    #[serde(default)]
    pub max_runtime: Option<i64>,
    /// tz database timezone string.
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub failure_issue_threshold: Option<i64>,
    #[serde(default)]
    pub recovery_threshold: Option<i64>,
    #[serde(default)]
    pub owner: Option<String>,
}

/// The monitor check-in payload as received in an envelope item.
#[derive(Debug, Clone, Deserialize)]
pub struct CheckInPayload {
    /// Unique identifier of this check-in (hex UUID). Optional; nil when absent.
    #[serde(default)]
    pub check_in_id: Option<String>,

    /// Identifier of the monitor for this check-in.
    #[serde(default)]
    pub monitor_slug: String,

    /// Status of this check-in.
    pub status: CheckInStatus,

    /// Environment to associate the check-in with.
    #[serde(default)]
    pub environment: Option<String>,

    /// Duration of this check-in in seconds.
    #[serde(default)]
    pub duration: Option<f64>,

    /// Monitor configuration, used to upsert the monitor's schedule.
    #[serde(default)]
    pub monitor_config: Option<MonitorConfig>,
}

/// Maximum length of a monitor slug (Relay's `SLUG_LENGTH`).
const SLUG_LENGTH: usize = 50;

/// Maximum length of an environment name (Relay's `ENVIRONMENT_LENGTH`).
const ENVIRONMENT_LENGTH: usize = 64;

impl CheckInPayload {
    /// Parses a check-in item payload. A malformed payload is a validation
    /// error, not a silent drop.
    pub fn parse(body: &[u8]) -> AppResult<Self> {
        serde_json::from_slice(body)
            .map_err(|e| AppError::Validation(format!("Invalid check-in JSON: {}", e)))
    }

    /// Normalizes the check-in in place, mirroring Relay's `process_check_in`:
    /// coerce a server-only `missed` to `unknown`, truncate the slug to
    /// [`SLUG_LENGTH`] characters, reject an empty slug, and reject an
    /// over-long environment.
    pub fn normalize(&mut self) -> AppResult<()> {
        if self.status == CheckInStatus::Missed {
            self.status = CheckInStatus::Unknown;
        }

        trim_to_chars(&mut self.monitor_slug, SLUG_LENGTH);
        if self.monitor_slug.is_empty() {
            return Err(AppError::Validation(
                "monitor slug is empty or invalid".to_string(),
            ));
        }

        if self
            .environment
            .as_ref()
            .is_some_and(|e| e.chars().count() > ENVIRONMENT_LENGTH)
        {
            return Err(AppError::Validation("environment is invalid".to_string()));
        }

        Ok(())
    }
}

/// Truncates a string to at most `max` characters (not bytes), preserving
/// UTF-8 boundaries. Mirrors Relay's `trim_slug`.
fn trim_to_chars(s: &mut String, max: usize) {
    if let Some((overflow, _)) = s.char_indices().nth(max) {
        s.truncate(overflow);
    }
}

/// A monitor (scheduled job) in the list view.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct MonitorResponse {
    pub id: Uuid,
    pub slug: String,
    /// Derived monitor status: active/ok/error/missed/timeout/disabled.
    pub status: String,
    pub schedule_type: Option<String>,
    pub schedule_value: Option<String>,
    pub schedule_unit: Option<String>,
    pub timezone: Option<String>,
    pub checkin_margin: Option<i64>,
    pub max_runtime: Option<i64>,
    pub last_check_in_at: Option<DateTime<Utc>>,
    pub last_check_in_status: Option<String>,
    pub next_expected_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// A single check-in (one reported execution) in the list view.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CheckInResponse {
    pub id: Uuid,
    pub status: String,
    /// Duration in seconds.
    pub duration: Option<f64>,
    pub environment: Option<String>,
    pub trace_id: Option<String>,
    pub timestamp: DateTime<Utc>,
}
