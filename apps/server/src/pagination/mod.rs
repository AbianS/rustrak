pub mod cursor;

pub use cursor::{EventCursor, IssueCursor, TransactionCursor};

use serde::{Deserialize, Serialize};

/// Default page size for pagination
pub const PAGE_SIZE: i64 = 20;

/// Paginated response wrapper (cursor-based)
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[cfg_attr(feature = "openapi", schema(bound = "T: utoipa::ToSchema"))]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
    pub has_more: bool,
}

impl<T> PaginatedResponse<T> {
    pub fn new(items: Vec<T>, next_cursor: Option<String>, has_more: bool) -> Self {
        Self {
            items,
            next_cursor,
            has_more,
        }
    }
}

/// Offset-based paginated response wrapper
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[cfg_attr(feature = "openapi", schema(bound = "T: utoipa::ToSchema"))]
pub struct OffsetPaginatedResponse<T> {
    pub items: Vec<T>,
    pub total_count: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}

impl<T> OffsetPaginatedResponse<T> {
    pub fn new(items: Vec<T>, total_count: i64, page: i64, per_page: i64) -> Self {
        let per_page = per_page.max(1);
        let total_pages = (total_count + per_page - 1) / per_page;
        Self {
            items,
            total_count,
            page,
            per_page,
            total_pages,
        }
    }
}

/// Sort mode for issues listing
#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
pub enum IssueSort {
    /// Sort by digest_order (stable, unique per project)
    #[default]
    DigestOrder,
    /// Sort by last_seen (activity-based, may reorder)
    LastSeen,
}

impl IssueSort {
    pub fn as_str(&self) -> &'static str {
        match self {
            IssueSort::DigestOrder => "digest_order",
            IssueSort::LastSeen => "last_seen",
        }
    }
}

impl std::fmt::Display for IssueSort {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Sort order direction
#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(rename_all = "lowercase")]
pub enum SortOrder {
    Asc,
    #[default]
    Desc,
}

impl SortOrder {
    pub fn as_str(&self) -> &'static str {
        match self {
            SortOrder::Asc => "asc",
            SortOrder::Desc => "desc",
        }
    }

    #[allow(dead_code)] // Utility method for future use
    pub fn is_desc(&self) -> bool {
        matches!(self, SortOrder::Desc)
    }
}

impl std::fmt::Display for SortOrder {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Query parameters for listing issues (offset-based)
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::IntoParams))]
pub struct ListIssuesQuery {
    /// Page number (1-indexed, default: 1)
    #[serde(default = "default_page")]
    #[cfg_attr(feature = "openapi", param(minimum = 1))]
    pub page: i64,

    /// Items per page (default: 20, max: 100)
    #[serde(default = "default_per_page")]
    #[cfg_attr(feature = "openapi", param(minimum = 1, maximum = 100))]
    pub per_page: i64,

    /// Sort mode (default: last_seen)
    #[serde(default)]
    pub sort: IssueSort,

    /// Sort order direction (default: desc)
    #[serde(default)]
    pub order: SortOrder,

    /// Filter: open (not resolved, not muted), resolved, muted, all
    #[serde(default)]
    pub filter: IssueFilter,
}

fn default_page() -> i64 {
    1
}

fn default_per_page() -> i64 {
    PAGE_SIZE
}

/// Filter for issues listing
#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
pub enum IssueFilter {
    /// Only open issues (not resolved and not muted)
    #[default]
    Open,
    /// Only resolved issues
    Resolved,
    /// Only muted issues
    Muted,
    /// All issues
    All,
}

/// Query parameters for listing events
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::IntoParams))]
pub struct ListEventsQuery {
    /// Sort order direction (default: desc = newest first)
    #[serde(default)]
    pub order: SortOrder,

    /// Pagination cursor
    pub cursor: Option<String>,
}

/// Query parameters for listing projects (offset-based)
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::IntoParams))]
pub struct ListProjectsQuery {
    /// Page number (1-indexed, default: 1)
    #[serde(default = "default_page")]
    #[cfg_attr(feature = "openapi", param(minimum = 1))]
    pub page: i64,

    /// Items per page (default: 20, max: 100)
    #[serde(default = "default_per_page")]
    #[cfg_attr(feature = "openapi", param(minimum = 1, maximum = 100))]
    pub per_page: i64,

    /// Sort order direction (default: desc = newest first)
    #[serde(default)]
    pub order: SortOrder,
}
