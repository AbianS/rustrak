use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Sentry's own release version cap (`Release.version` is `VARCHAR(250)` upstream,
/// but the documented/enforced limit sentry-cli and the web UI honor is 200).
pub const MAX_VERSION_LEN: usize = 200;

/// Release model — one row per `(project_id, version)`.
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Release {
    pub id: i32,
    pub project_id: i32,
    pub version: String,
    #[sqlx(rename = "ref")]
    pub reference: Option<String>,
    pub url: Option<String>,
    pub date_created: DateTime<Utc>,
    pub date_released: Option<DateTime<Utc>>,
}

/// DTO for `POST .../releases/`.
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateRelease {
    pub version: String,
    #[serde(default, rename = "ref")]
    pub reference: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
}

/// DTO for `PUT .../releases/{version}/` — generic partial update.
/// Setting `date_released` IS "finalize": there is no separate status flag.
/// Absent fields (including an explicit `null`) leave the stored value
/// unchanged, matching Sentry's own partial-update semantics for this endpoint.
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateRelease {
    #[serde(default, rename = "ref")]
    pub reference: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default, rename = "dateReleased")]
    pub date_released: Option<DateTime<Utc>>,
}

/// API response for a release.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ReleaseResponse {
    pub version: String,
    #[serde(rename = "ref")]
    pub reference: Option<String>,
    pub url: Option<String>,
    #[serde(rename = "dateCreated")]
    pub date_created: DateTime<Utc>,
    #[serde(rename = "dateReleased")]
    pub date_released: Option<DateTime<Utc>>,
}

impl Release {
    pub fn to_response(&self) -> ReleaseResponse {
        ReleaseResponse {
            version: self.version.clone(),
            reference: self.reference.clone(),
            url: self.url.clone(),
            date_created: self.date_created,
            date_released: self.date_released,
        }
    }
}

/// Sentry-compatible release version validation, mirrored from Sentry's
/// `is_valid_version` (`src/sentry/models/release.py`): rejects empty/missing,
/// the literal path segments `.`/`..`, the reserved alias `latest`
/// (case-insensitive), any of the control/separator characters
/// `\r \n \x0c \t / \` (a release version is used as a URL path segment
/// upstream), and anything over 200 chars.
pub fn is_valid_version(version: &str) -> bool {
    if version.is_empty() || version.chars().count() > MAX_VERSION_LEN {
        return false;
    }
    if version == "." || version == ".." {
        return false;
    }
    if version.eq_ignore_ascii_case("latest") {
        return false;
    }
    const FORBIDDEN: &[char] = &['\r', '\n', '\x0c', '\t', '/', '\\'];
    !version.chars().any(|c| FORBIDDEN.contains(&c))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_simple_version_accepted() {
        assert!(is_valid_version("1.2.1"));
    }

    #[test]
    fn empty_version_rejected() {
        assert!(!is_valid_version(""));
    }

    #[test]
    fn dot_rejected() {
        assert!(!is_valid_version("."));
    }

    #[test]
    fn dotdot_rejected() {
        assert!(!is_valid_version(".."));
    }

    #[test]
    fn path_traversal_rejected() {
        assert!(!is_valid_version("../etc"));
    }

    #[test]
    fn latest_rejected_case_insensitive() {
        assert!(!is_valid_version("latest"));
        assert!(!is_valid_version("Latest"));
        assert!(!is_valid_version("LATEST"));
    }

    #[test]
    fn slash_rejected() {
        assert!(!is_valid_version("a/b"));
    }

    #[test]
    fn backslash_rejected() {
        assert!(!is_valid_version("a\\b"));
    }

    #[test]
    fn control_chars_rejected() {
        assert!(!is_valid_version("a\rb"));
        assert!(!is_valid_version("a\nb"));
        assert!(!is_valid_version("a\tb"));
        assert!(!is_valid_version("a\x0cb"));
    }

    #[test]
    fn over_max_len_rejected() {
        let version = "a".repeat(MAX_VERSION_LEN + 1);
        assert!(!is_valid_version(&version));
    }

    #[test]
    fn exactly_max_len_accepted() {
        let version = "a".repeat(MAX_VERSION_LEN);
        assert!(is_valid_version(&version));
    }
}
