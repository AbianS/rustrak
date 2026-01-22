use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{AppError, AppResult};

/// Cursor for paginating Issues
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssueCursor {
    /// Sort mode: "digest_order" or "last_seen"
    pub sort: String,
    /// Direction: "asc" or "desc"
    pub order: String,
    /// Last digest_order value seen
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_digest_order: Option<i32>,
    /// Last last_seen value (RFC3339)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_seen: Option<DateTime<Utc>>,
    /// Last ID seen (tie-breaker for last_seen sort)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_id: Option<Uuid>,
}

impl IssueCursor {
    pub fn new(sort: &str, order: &str) -> Self {
        Self {
            sort: sort.to_string(),
            order: order.to_string(),
            last_digest_order: None,
            last_seen: None,
            last_id: None,
        }
    }

    pub fn with_digest_order(mut self, digest_order: i32) -> Self {
        self.last_digest_order = Some(digest_order);
        self
    }

    pub fn with_last_seen(mut self, last_seen: DateTime<Utc>, id: Uuid) -> Self {
        self.last_seen = Some(last_seen);
        self.last_id = Some(id);
        self
    }

    pub fn encode(&self) -> AppResult<String> {
        let json = serde_json::to_string(self)
            .map_err(|e| AppError::Internal(format!("Cursor serialization failed: {}", e)))?;
        Ok(URL_SAFE_NO_PAD.encode(json.as_bytes()))
    }

    pub fn decode(s: &str) -> AppResult<Self> {
        let bytes = URL_SAFE_NO_PAD
            .decode(s)
            .map_err(|_| AppError::Validation("Invalid cursor encoding".to_string()))?;

        let json = String::from_utf8(bytes)
            .map_err(|_| AppError::Validation("Invalid cursor encoding".to_string()))?;

        serde_json::from_str(&json)
            .map_err(|_| AppError::Validation("Invalid cursor format".to_string()))
    }
}

/// Cursor for paginating Events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventCursor {
    /// Direction: "asc" or "desc"
    pub order: String,
    /// Last digest_order value seen
    pub last_digest_order: i32,
}

impl EventCursor {
    pub fn new(order: &str, last_digest_order: i32) -> Self {
        Self {
            order: order.to_string(),
            last_digest_order,
        }
    }

    pub fn encode(&self) -> AppResult<String> {
        let json = serde_json::to_string(self)
            .map_err(|e| AppError::Internal(format!("Cursor serialization failed: {}", e)))?;
        Ok(URL_SAFE_NO_PAD.encode(json.as_bytes()))
    }

    pub fn decode(s: &str) -> AppResult<Self> {
        let bytes = URL_SAFE_NO_PAD
            .decode(s)
            .map_err(|_| AppError::Validation("Invalid cursor encoding".to_string()))?;

        let json = String::from_utf8(bytes)
            .map_err(|_| AppError::Validation("Invalid cursor encoding".to_string()))?;

        serde_json::from_str(&json)
            .map_err(|_| AppError::Validation("Invalid cursor format".to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_issue_cursor_encode_decode() {
        let cursor = IssueCursor::new("digest_order", "desc").with_digest_order(42);

        let encoded = cursor.encode().unwrap();
        let decoded = IssueCursor::decode(&encoded).unwrap();

        assert_eq!(decoded.sort, "digest_order");
        assert_eq!(decoded.order, "desc");
        assert_eq!(decoded.last_digest_order, Some(42));
    }

    #[test]
    fn test_event_cursor_encode_decode() {
        let cursor = EventCursor::new("asc", 100);

        let encoded = cursor.encode().unwrap();
        let decoded = EventCursor::decode(&encoded).unwrap();

        assert_eq!(decoded.order, "asc");
        assert_eq!(decoded.last_digest_order, 100);
    }

    #[test]
    fn test_invalid_cursor() {
        let result = IssueCursor::decode("not-valid-base64!!!");
        assert!(result.is_err());
    }
}
