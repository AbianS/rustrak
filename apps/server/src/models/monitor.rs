//! Monitor models for the uptime monitoring system.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// =============================================================================
// CheckType Enum
// =============================================================================

/// Type of uptime check
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
pub enum CheckType {
    Http,
    Tcp,
}

impl std::fmt::Display for CheckType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CheckType::Http => write!(f, "http"),
            CheckType::Tcp => write!(f, "tcp"),
        }
    }
}

impl TryFrom<&str> for CheckType {
    type Error = String;

    fn try_from(s: &str) -> Result<Self, Self::Error> {
        match s {
            "http" => Ok(CheckType::Http),
            "tcp" => Ok(CheckType::Tcp),
            other => Err(format!("unknown check_type: {other}")),
        }
    }
}

// =============================================================================
// MonitorStateEnum
// =============================================================================

/// State of a monitor in the state machine
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
pub enum MonitorStateEnum {
    Up,
    PendingDown,
    Down,
    PendingUp,
}

impl TryFrom<&str> for MonitorStateEnum {
    type Error = String;

    fn try_from(s: &str) -> Result<Self, Self::Error> {
        match s {
            "up" => Ok(MonitorStateEnum::Up),
            "pending_down" => Ok(MonitorStateEnum::PendingDown),
            "down" => Ok(MonitorStateEnum::Down),
            "pending_up" => Ok(MonitorStateEnum::PendingUp),
            other => Err(format!("unknown state: {other}")),
        }
    }
}

impl std::fmt::Display for MonitorStateEnum {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MonitorStateEnum::Up => write!(f, "up"),
            MonitorStateEnum::PendingDown => write!(f, "pending_down"),
            MonitorStateEnum::Down => write!(f, "down"),
            MonitorStateEnum::PendingUp => write!(f, "pending_up"),
        }
    }
}

// =============================================================================
// Monitor Model
// =============================================================================

/// A monitor configuration record
#[derive(Debug, Clone, Serialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Monitor {
    pub id: Uuid,
    pub name: String,
    pub check_type: String,
    pub url: String,
    pub interval_secs: i32,
    pub timeout_secs: i32,
    pub expected_status: Option<i32>,
    pub fail_threshold: i32,
    pub recovery_threshold: i32,
    pub repeat_interval_secs: i32,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a new monitor
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateMonitor {
    pub name: String,
    pub check_type: String,
    pub url: String,
    pub interval_secs: Option<i32>,
    pub timeout_secs: Option<i32>,
    pub expected_status: Option<i32>,
    pub fail_threshold: Option<i32>,
    pub recovery_threshold: Option<i32>,
    pub repeat_interval_secs: Option<i32>,
}

/// DTO for updating a monitor
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateMonitor {
    pub name: Option<String>,
    pub url: Option<String>,
    pub interval_secs: Option<i32>,
    pub timeout_secs: Option<i32>,
    pub expected_status: Option<i32>,
    pub fail_threshold: Option<i32>,
    pub recovery_threshold: Option<i32>,
    pub repeat_interval_secs: Option<i32>,
    pub enabled: Option<bool>,
}

// =============================================================================
// MonitorCheck Model
// =============================================================================

/// A single probe result stored in monitor_checks
#[derive(Debug, Clone, Serialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct MonitorCheck {
    pub id: Uuid,
    pub monitor_id: Uuid,
    pub checked_at: DateTime<Utc>,
    pub status: i32,
    pub latency_ms: Option<i32>,
    pub error_message: Option<String>,
}

// =============================================================================
// MonitorIncident Model
// =============================================================================

/// An incident representing a period of downtime
#[derive(Debug, Clone, Serialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct MonitorIncident {
    pub id: Uuid,
    pub monitor_id: Uuid,
    pub started_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
}

// =============================================================================
// MonitorState Model
// =============================================================================

/// State machine state for a monitor
#[derive(Debug, Clone, Serialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct MonitorState {
    pub monitor_id: Uuid,
    pub state: String,
    pub fail_counter: i32,
    pub recovery_counter: i32,
    pub last_check_at: Option<DateTime<Utc>>,
    pub next_check_at: DateTime<Utc>,
    pub alerted_down_at: Option<DateTime<Utc>>,
    pub last_alerted_at: Option<DateTime<Utc>>,
    pub alert_count: i32,
    pub incident_id: Option<Uuid>,
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_type_display() {
        assert_eq!(CheckType::Http.to_string(), "http");
        assert_eq!(CheckType::Tcp.to_string(), "tcp");
    }

    #[test]
    fn test_check_type_try_from_valid() {
        assert_eq!(CheckType::try_from("http"), Ok(CheckType::Http));
        assert_eq!(CheckType::try_from("tcp"), Ok(CheckType::Tcp));
    }

    #[test]
    fn test_check_type_try_from_invalid() {
        let result = CheckType::try_from("udp");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("unknown check_type: udp"));
    }

    #[test]
    fn test_monitor_state_enum_display() {
        assert_eq!(MonitorStateEnum::Up.to_string(), "up");
        assert_eq!(MonitorStateEnum::PendingDown.to_string(), "pending_down");
        assert_eq!(MonitorStateEnum::Down.to_string(), "down");
        assert_eq!(MonitorStateEnum::PendingUp.to_string(), "pending_up");
    }

    #[test]
    fn test_monitor_state_enum_try_from_valid() {
        assert_eq!(MonitorStateEnum::try_from("up"), Ok(MonitorStateEnum::Up));
        assert_eq!(
            MonitorStateEnum::try_from("pending_down"),
            Ok(MonitorStateEnum::PendingDown)
        );
        assert_eq!(
            MonitorStateEnum::try_from("down"),
            Ok(MonitorStateEnum::Down)
        );
        assert_eq!(
            MonitorStateEnum::try_from("pending_up"),
            Ok(MonitorStateEnum::PendingUp)
        );
    }

    #[test]
    fn test_monitor_state_enum_try_from_invalid() {
        let result = MonitorStateEnum::try_from("unknown");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("unknown state: unknown"));
    }

    #[test]
    fn test_check_type_equality() {
        assert_eq!(CheckType::Http, CheckType::Http);
        assert_ne!(CheckType::Http, CheckType::Tcp);
    }

    #[test]
    fn test_monitor_state_enum_equality() {
        assert_eq!(MonitorStateEnum::Up, MonitorStateEnum::Up);
        assert_ne!(MonitorStateEnum::Up, MonitorStateEnum::Down);
    }
}
