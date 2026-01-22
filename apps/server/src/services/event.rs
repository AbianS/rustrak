use chrono::{DateTime, Utc};
use ipnetwork::IpNetwork;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::Event;
use crate::pagination::{EventCursor, SortOrder};
use crate::services::grouping::DenormalizedFields;

pub struct EventService;

impl EventService {
    /// Lists events with cursor-based pagination
    ///
    /// Uses KEYSET pagination for efficient large dataset handling.
    /// Returns (events, has_more) where has_more indicates if there are more results.
    pub async fn list_paginated(
        pool: &PgPool,
        issue_id: Uuid,
        order: SortOrder,
        cursor: Option<&EventCursor>,
        limit: i64,
    ) -> AppResult<(Vec<Event>, bool)> {
        // Fetch limit+1 to determine if there are more results
        let fetch_limit = limit + 1;

        let events = match (order, cursor) {
            // DESC (newest first) - no cursor
            (SortOrder::Desc, None) => {
                sqlx::query_as::<_, Event>(
                    r#"
                    SELECT * FROM events
                    WHERE issue_id = $1
                    ORDER BY digest_order DESC
                    LIMIT $2
                    "#,
                )
                .bind(issue_id)
                .bind(fetch_limit)
                .fetch_all(pool)
                .await?
            }

            // DESC - with cursor
            (SortOrder::Desc, Some(c)) => {
                sqlx::query_as::<_, Event>(
                    r#"
                    SELECT * FROM events
                    WHERE issue_id = $1 AND digest_order < $3
                    ORDER BY digest_order DESC
                    LIMIT $2
                    "#,
                )
                .bind(issue_id)
                .bind(fetch_limit)
                .bind(c.last_digest_order)
                .fetch_all(pool)
                .await?
            }

            // ASC (oldest first) - no cursor
            (SortOrder::Asc, None) => {
                sqlx::query_as::<_, Event>(
                    r#"
                    SELECT * FROM events
                    WHERE issue_id = $1
                    ORDER BY digest_order ASC
                    LIMIT $2
                    "#,
                )
                .bind(issue_id)
                .bind(fetch_limit)
                .fetch_all(pool)
                .await?
            }

            // ASC - with cursor
            (SortOrder::Asc, Some(c)) => {
                sqlx::query_as::<_, Event>(
                    r#"
                    SELECT * FROM events
                    WHERE issue_id = $1 AND digest_order > $3
                    ORDER BY digest_order ASC
                    LIMIT $2
                    "#,
                )
                .bind(issue_id)
                .bind(fetch_limit)
                .bind(c.last_digest_order)
                .fetch_all(pool)
                .await?
            }
        };

        let has_more = events.len() > limit as usize;
        let events: Vec<Event> = events.into_iter().take(limit as usize).collect();

        Ok((events, has_more))
    }

    /// Gets an event by ID
    pub async fn get_by_id(pool: &PgPool, id: Uuid) -> AppResult<Event> {
        let event = sqlx::query_as::<_, Event>("SELECT * FROM events WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Event {} not found", id)))?;

        Ok(event)
    }

    /// Creates a new event
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        pool: &PgPool,
        event_id: Uuid,
        project_id: i32,
        issue_id: Uuid,
        grouping_id: i32,
        event_data: &serde_json::Value,
        ingested_at: DateTime<Utc>,
        denormalized: &DenormalizedFields,
        digest_order: i32,
        remote_addr: Option<&str>,
    ) -> AppResult<Event> {
        // Extract fields from event_data
        let timestamp = event_data
            .get("timestamp")
            .and_then(|t| {
                if let Some(ts) = t.as_f64() {
                    DateTime::from_timestamp(ts as i64, ((ts.fract()) * 1_000_000_000.0) as u32)
                } else if let Some(ts_str) = t.as_str() {
                    DateTime::parse_from_rfc3339(ts_str)
                        .ok()
                        .map(|dt| dt.to_utc())
                } else {
                    None
                }
            })
            .unwrap_or(ingested_at);

        let level = event_data
            .get("level")
            .and_then(|l| l.as_str())
            .unwrap_or("error");

        let platform = event_data
            .get("platform")
            .and_then(|p| p.as_str())
            .unwrap_or("");

        let release = event_data
            .get("release")
            .and_then(|r| r.as_str())
            .unwrap_or("");

        let environment = event_data
            .get("environment")
            .and_then(|e| e.as_str())
            .unwrap_or("");

        let server_name = event_data
            .get("server_name")
            .and_then(|s| s.as_str())
            .unwrap_or("");

        let sdk_name = event_data
            .get("sdk")
            .and_then(|s| s.get("name"))
            .and_then(|n| n.as_str())
            .unwrap_or("");

        let sdk_version = event_data
            .get("sdk")
            .and_then(|s| s.get("version"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        // Parse remote_addr as IpNetwork if provided
        let remote_addr_inet: Option<IpNetwork> =
            remote_addr.and_then(|addr| addr.parse::<std::net::IpAddr>().ok().map(IpNetwork::from));

        let event = sqlx::query_as::<_, Event>(
            r#"
            INSERT INTO events (
                event_id, project_id, issue_id, grouping_id, data,
                timestamp, ingested_at,
                calculated_type, calculated_value, transaction,
                last_frame_filename, last_frame_module, last_frame_function,
                level, platform, release, environment, server_name,
                sdk_name, sdk_version, digest_order, remote_addr
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
            RETURNING *
            "#,
        )
        .bind(event_id)
        .bind(project_id)
        .bind(issue_id)
        .bind(grouping_id)
        .bind(event_data)
        .bind(timestamp)
        .bind(ingested_at)
        .bind(&denormalized.calculated_type)
        .bind(&denormalized.calculated_value)
        .bind(&denormalized.transaction)
        .bind(&denormalized.last_frame_filename)
        .bind(&denormalized.last_frame_module)
        .bind(&denormalized.last_frame_function)
        .bind(level)
        .bind(platform)
        .bind(release)
        .bind(environment)
        .bind(server_name)
        .bind(sdk_name)
        .bind(sdk_version)
        .bind(digest_order)
        .bind(remote_addr_inet)
        .fetch_one(pool)
        .await?;

        Ok(event)
    }

    /// Checks if an event with this event_id already exists in the project
    pub async fn exists(pool: &PgPool, project_id: i32, event_id: Uuid) -> AppResult<bool> {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM events WHERE project_id = $1 AND event_id = $2)",
        )
        .bind(project_id)
        .bind(event_id)
        .fetch_one(pool)
        .await?;

        Ok(exists)
    }
}
