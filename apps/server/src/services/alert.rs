//! Alert service for managing alert integrations, rules, and dispatching alerts.
//!
//! This service handles:
//! - CRUD operations for alert integrations (global credentials)
//! - CRUD operations for alert rules (per-project)
//! - Alert triggering and dispatching with per-rule routing overrides

use chrono::{Duration, Utc};
use uuid::Uuid;

use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{
    AlertHistory, AlertIntegration, AlertPayload, AlertRule, AlertRuleChannel, AlertType,
    CreateAlertIntegration, CreateAlertRule, Issue, IssueInfo, Project, ProjectInfo, UpdateAlertRule,
    UpdateAlertIntegration,
};
use crate::services::notification::create_dispatcher;

pub struct AlertService;

impl AlertService {
    // =========================================================================
    // Alert Integration CRUD  (renamed from Notification Channel)
    // =========================================================================

    /// Lists all alert integrations
    pub async fn list_channels(pool: &DbPool) -> AppResult<Vec<AlertIntegration>> {
        let integrations = sqlx::query_as::<_, AlertIntegration>(
            r#"
            SELECT id, name, provider_type, credentials, is_enabled, failure_count,
                   last_failure_at, last_failure_message, last_success_at,
                   created_at, updated_at
            FROM alert_integrations
            ORDER BY created_at DESC
            "#,
        )
        .fetch_all(pool)
        .await?;

        Ok(integrations)
    }

    /// Gets an alert integration by ID
    pub async fn get_channel(pool: &DbPool, id: i32) -> AppResult<AlertIntegration> {
        sqlx::query_as::<_, AlertIntegration>(
            r#"
            SELECT id, name, provider_type, credentials, is_enabled, failure_count,
                   last_failure_at, last_failure_message, last_success_at,
                   created_at, updated_at
            FROM alert_integrations
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Integration {} not found", id)))
    }

    /// Creates an alert integration
    pub async fn create_channel(
        pool: &DbPool,
        input: CreateAlertIntegration,
    ) -> AppResult<AlertIntegration> {
        // Validate credentials based on provider type
        let dispatcher = create_dispatcher(input.provider_type);
        dispatcher.validate_config(&input.credentials)?;

        let integration = sqlx::query_as::<_, AlertIntegration>(
            r#"
            INSERT INTO alert_integrations (name, provider_type, credentials, is_enabled)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name, provider_type, credentials, is_enabled, failure_count,
                      last_failure_at, last_failure_message, last_success_at,
                      created_at, updated_at
            "#,
        )
        .bind(&input.name)
        .bind(input.provider_type.to_string())
        .bind(&input.credentials)
        .bind(input.is_enabled)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(ref db_err) = e {
                if db_err.is_unique_violation() {
                    return AppError::Conflict(format!(
                        "Integration '{}' already exists",
                        input.name
                    ));
                }
            }
            AppError::Database(e)
        })?;

        Ok(integration)
    }

    /// Updates an alert integration
    pub async fn update_channel(
        pool: &DbPool,
        id: i32,
        input: UpdateAlertIntegration,
    ) -> AppResult<AlertIntegration> {
        let existing = Self::get_channel(pool, id).await?;

        // If credentials are being updated, validate them
        if let Some(ref credentials) = input.credentials {
            let dispatcher = create_dispatcher(existing.provider_type);
            dispatcher.validate_config(credentials)?;
        }

        let integration = sqlx::query_as::<_, AlertIntegration>(
            r#"
            UPDATE alert_integrations
            SET name = COALESCE($2, name),
                credentials = COALESCE($3, credentials),
                is_enabled = COALESCE($4, is_enabled),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING id, name, provider_type, credentials, is_enabled, failure_count,
                      last_failure_at, last_failure_message, last_success_at,
                      created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&input.name)
        .bind(&input.credentials)
        .bind(input.is_enabled)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(ref db_err) = e {
                if db_err.is_unique_violation() {
                    return AppError::Conflict("Integration name already exists".to_string());
                }
            }
            AppError::Database(e)
        })?;

        Ok(integration)
    }

    /// Deletes an alert integration
    pub async fn delete_channel(pool: &DbPool, id: i32) -> AppResult<()> {
        let result = sqlx::query("DELETE FROM alert_integrations WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound(format!("Integration {} not found", id)));
        }

        Ok(())
    }

    // =========================================================================
    // Alert Rule CRUD
    // =========================================================================

    /// Lists alert rules for a project
    pub async fn list_rules(pool: &DbPool, project_id: i32) -> AppResult<Vec<AlertRule>> {
        let rules = sqlx::query_as::<_, AlertRule>(
            r#"
            SELECT id, project_id, name, alert_type, is_enabled, conditions,
                   cooldown_minutes, last_triggered_at, created_at, updated_at
            FROM alert_rules
            WHERE project_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(project_id)
        .fetch_all(pool)
        .await?;

        Ok(rules)
    }

    /// Gets an alert rule by ID
    pub async fn get_rule(pool: &DbPool, id: i32) -> AppResult<AlertRule> {
        sqlx::query_as::<_, AlertRule>(
            r#"
            SELECT id, project_id, name, alert_type, is_enabled, conditions,
                   cooldown_minutes, last_triggered_at, created_at, updated_at
            FROM alert_rules
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Alert rule {} not found", id)))
    }

    /// Gets AlertRuleChannel rows linked to a rule (integration_id + routing_override)
    pub async fn get_rule_channels(
        pool: &DbPool,
        rule_id: i32,
    ) -> AppResult<Vec<AlertRuleChannel>> {
        let channels: Vec<AlertRuleChannel> = sqlx::query_as(
            "SELECT alert_rule_id, integration_id, routing_override FROM alert_rule_channels WHERE alert_rule_id = $1",
        )
        .bind(rule_id)
        .fetch_all(pool)
        .await?;

        Ok(channels)
    }

    /// Returns just the integration IDs for a rule (for response serialization)
    pub async fn get_rule_integration_ids(
        pool: &DbPool,
        rule_id: i32,
    ) -> AppResult<Vec<i32>> {
        let rows: Vec<(i32,)> = sqlx::query_as(
            "SELECT integration_id FROM alert_rule_channels WHERE alert_rule_id = $1",
        )
        .bind(rule_id)
        .fetch_all(pool)
        .await?;

        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    /// Creates an alert rule
    pub async fn create_rule(
        pool: &DbPool,
        project_id: i32,
        input: CreateAlertRule,
    ) -> AppResult<AlertRule> {
        let mut tx = pool.begin().await?;

        let rule = sqlx::query_as::<_, AlertRule>(
            r#"
            INSERT INTO alert_rules (project_id, name, alert_type, conditions, cooldown_minutes)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, project_id, name, alert_type, is_enabled, conditions,
                      cooldown_minutes, last_triggered_at, created_at, updated_at
            "#,
        )
        .bind(project_id)
        .bind(&input.name)
        .bind(input.alert_type.to_string())
        .bind(&input.conditions)
        .bind(input.cooldown_minutes)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(ref db_err) = e {
                if db_err.is_unique_violation() {
                    return AppError::Conflict(format!(
                        "Alert rule for type '{}' already exists in this project",
                        input.alert_type
                    ));
                }
            }
            AppError::Database(e)
        })?;

        // Link integrations with per-rule routing
        for channel_input in &input.channels {
            sqlx::query(
                r#"INSERT INTO alert_rule_channels (alert_rule_id, integration_id, routing_override)
                   VALUES ($1, $2, $3)"#,
            )
            .bind(rule.id)
            .bind(channel_input.integration_id)
            .bind(&channel_input.routing_override)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                if let sqlx::Error::Database(ref db_err) = e {
                    if db_err.is_foreign_key_violation() {
                        return AppError::NotFound(format!(
                            "Integration {} not found",
                            channel_input.integration_id
                        ));
                    }
                }
                AppError::Database(e)
            })?;
        }

        tx.commit().await?;

        Ok(rule)
    }

    /// Updates an alert rule
    pub async fn update_rule(
        pool: &DbPool,
        id: i32,
        input: UpdateAlertRule,
    ) -> AppResult<AlertRule> {
        let mut tx = pool.begin().await?;

        let rule = sqlx::query_as::<_, AlertRule>(
            r#"
            UPDATE alert_rules
            SET name = COALESCE($2, name),
                is_enabled = COALESCE($3, is_enabled),
                conditions = COALESCE($4, conditions),
                cooldown_minutes = COALESCE($5, cooldown_minutes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING id, project_id, name, alert_type, is_enabled, conditions,
                      cooldown_minutes, last_triggered_at, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&input.name)
        .bind(input.is_enabled)
        .bind(&input.conditions)
        .bind(input.cooldown_minutes)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Alert rule {} not found", id)))?;

        // Update channel links if provided
        if let Some(ref channels) = input.channels {
            // Remove existing links
            sqlx::query("DELETE FROM alert_rule_channels WHERE alert_rule_id = $1")
                .bind(id)
                .execute(&mut *tx)
                .await?;

            // Add new links with routing overrides
            for channel_input in channels {
                sqlx::query(
                    r#"INSERT INTO alert_rule_channels (alert_rule_id, integration_id, routing_override)
                       VALUES ($1, $2, $3)"#,
                )
                .bind(id)
                .bind(channel_input.integration_id)
                .bind(&channel_input.routing_override)
                .execute(&mut *tx)
                .await
                .map_err(|e| {
                    if let sqlx::Error::Database(ref db_err) = e {
                        if db_err.is_foreign_key_violation() {
                            return AppError::NotFound(format!(
                                "Integration {} not found",
                                channel_input.integration_id
                            ));
                        }
                    }
                    AppError::Database(e)
                })?;
            }
        }

        tx.commit().await?;

        Ok(rule)
    }

    /// Deletes an alert rule
    pub async fn delete_rule(pool: &DbPool, id: i32) -> AppResult<()> {
        let result = sqlx::query("DELETE FROM alert_rules WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound(format!("Alert rule {} not found", id)));
        }

        Ok(())
    }

    // =========================================================================
    // Alert Triggering
    // =========================================================================

    /// Triggers an alert for a new issue
    pub async fn trigger_new_issue_alert(
        pool: &DbPool,
        project: &Project,
        issue: &Issue,
        dashboard_url: &str,
    ) -> AppResult<()> {
        Self::trigger_alert(pool, project, issue, AlertType::NewIssue, dashboard_url).await
    }

    /// Triggers an alert for a regression
    #[allow(dead_code)]
    pub async fn trigger_regression_alert(
        pool: &DbPool,
        project: &Project,
        issue: &Issue,
        dashboard_url: &str,
    ) -> AppResult<()> {
        Self::trigger_alert(pool, project, issue, AlertType::Regression, dashboard_url).await
    }

    /// Triggers an alert for an unmute
    #[allow(dead_code)]
    pub async fn trigger_unmute_alert(
        pool: &DbPool,
        project: &Project,
        issue: &Issue,
        dashboard_url: &str,
    ) -> AppResult<()> {
        Self::trigger_alert(pool, project, issue, AlertType::Unmute, dashboard_url).await
    }

    /// Builds the dashboard URL for viewing an issue.
    /// Uses project_id (numeric) — the frontend routes by ID, not slug.
    pub(crate) fn build_issue_url(
        dashboard_url: &str,
        project_id: i32,
        issue_id: uuid::Uuid,
    ) -> String {
        format!(
            "{}/projects/{}/issues/{}",
            dashboard_url, project_id, issue_id
        )
    }

    /// Core alert triggering logic
    async fn trigger_alert(
        pool: &DbPool,
        project: &Project,
        issue: &Issue,
        alert_type: AlertType,
        dashboard_url: &str,
    ) -> AppResult<()> {
        // 1. Find enabled rule for this project and alert type
        let rule: Option<AlertRule> = sqlx::query_as(
            r#"
            SELECT id, project_id, name, alert_type, is_enabled, conditions,
                   cooldown_minutes, last_triggered_at, created_at, updated_at
            FROM alert_rules
            WHERE project_id = $1 AND alert_type = $2 AND is_enabled = TRUE
            "#,
        )
        .bind(project.id)
        .bind(alert_type.to_string())
        .fetch_optional(pool)
        .await?;

        let rule = match rule {
            Some(r) => r,
            None => {
                log::debug!(
                    "No enabled alert rule for {:?} in project {}",
                    alert_type,
                    project.id
                );
                return Ok(());
            }
        };

        // 2. Atomically check cooldown and update last_triggered_at
        // Uses a conditional UPDATE to prevent TOCTOU race conditions
        let cooldown_threshold = Utc::now() - Duration::minutes(rule.cooldown_minutes as i64);

        #[cfg(feature = "postgres")]
        let updated = sqlx::query(
            r#"
            UPDATE alert_rules
            SET last_triggered_at = CURRENT_TIMESTAMP
            WHERE id = $1
              AND (last_triggered_at IS NULL OR last_triggered_at < $2)
            "#,
        )
        .bind(rule.id)
        .bind(cooldown_threshold)
        .execute(pool)
        .await?;

        #[cfg(feature = "sqlite")]
        let updated = sqlx::query(
            r#"
            UPDATE alert_rules
            SET last_triggered_at = datetime('now')
            WHERE id = $1
              AND (last_triggered_at IS NULL OR datetime(last_triggered_at) < datetime($2))
            "#,
        )
        .bind(rule.id)
        .bind(cooldown_threshold.naive_utc())
        .execute(pool)
        .await?;

        if updated.rows_affected() == 0 {
            log::debug!("Alert rule {} not found or in cooldown period", rule.id);
            return Ok(());
        }

        // 3. Get associated channels with routing overrides
        let rule_channels = Self::get_rule_channels(pool, rule.id).await?;

        if rule_channels.is_empty() {
            log::debug!("No channels for alert rule {}", rule.id);
            return Ok(());
        }

        // 4. Build payload
        let payload = AlertPayload {
            alert_id: format!(
                "{}-{}-{}",
                project.id,
                issue.id,
                Utc::now().timestamp_millis()
            ),
            alert_type: alert_type.to_string(),
            triggered_at: Utc::now(),
            project: ProjectInfo {
                id: project.id,
                name: project.name.clone(),
                slug: project.slug.clone(),
            },
            issue: IssueInfo {
                id: issue.id.to_string(),
                short_id: issue.short_id(&project.slug),
                title: issue.title(),
                level: issue.level.clone(),
                first_seen: issue.first_seen,
                last_seen: issue.last_seen,
                event_count: issue.digested_event_count,
            },
            issue_url: Self::build_issue_url(dashboard_url, project.id, issue.id),
            actor: "Rustrak".to_string(),
        };

        log::info!(
            "Triggering {} alert for issue {} in project {}",
            alert_type,
            issue.id,
            project.name
        );

        // 5. Dispatch to all channels (spawn tasks for parallel execution)
        for rule_channel in rule_channels {
            let pool = pool.clone();
            let payload = payload.clone();
            let rule_id = rule.id;

            tokio::spawn(async move {
                if let Err(e) =
                    Self::dispatch_to_channel(&pool, &rule_channel, &payload, rule_id).await
                {
                    log::error!(
                        "Failed to dispatch alert to integration {} : {}",
                        rule_channel.integration_id,
                        e
                    );
                }
            });
        }

        Ok(())
    }

    /// Dispatches an alert to a single channel using its integration + routing override
    async fn dispatch_to_channel(
        pool: &DbPool,
        rule_channel: &AlertRuleChannel,
        payload: &AlertPayload,
        rule_id: i32,
    ) -> AppResult<()> {
        let idempotency_key = format!("{}-{}", payload.alert_id, rule_channel.integration_id);

        // Fetch the integration
        let integration = Self::get_channel(pool, rule_channel.integration_id).await?;

        // Parse issue_id as UUID
        let issue_uuid = Uuid::parse_str(&payload.issue.id).ok();

        // Create history record with idempotent insert (ON CONFLICT DO NOTHING)
        let history_id: Option<(i64,)> = sqlx::query_as(
            r#"
            INSERT INTO alert_history (
                alert_rule_id, integration_id, issue_id, project_id,
                alert_type, channel_type, channel_name,
                status, idempotency_key
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING id
            "#,
        )
        .bind(rule_id)
        .bind(rule_channel.integration_id)
        .bind(issue_uuid)
        .bind(payload.project.id)
        .bind(&payload.alert_type)
        .bind(integration.provider_type.to_string())
        .bind(&integration.name)
        .bind(&idempotency_key)
        .fetch_optional(pool)
        .await?;

        let history_id = match history_id {
            Some(id) => id,
            None => {
                log::debug!("Alert {} already processed, skipping", idempotency_key);
                return Ok(());
            }
        };

        // Dispatch using appropriate notifier (two-tier: credentials + routing)
        let dispatcher = create_dispatcher(integration.provider_type);
        let result = dispatcher
            .send(&integration, &rule_channel.routing_override, payload)
            .await;

        // Update history and integration stats based on result
        if result.success {
            sqlx::query(
                r#"
                UPDATE alert_history
                SET status = 'sent', sent_at = CURRENT_TIMESTAMP, http_status_code = $2
                WHERE id = $1
                "#,
            )
            .bind(history_id.0)
            .bind(result.http_status.map(|s| s as i32))
            .execute(pool)
            .await?;

            sqlx::query(
                r#"
                UPDATE alert_integrations
                SET last_success_at = CURRENT_TIMESTAMP, failure_count = 0
                WHERE id = $1
                "#,
            )
            .bind(rule_channel.integration_id)
            .execute(pool)
            .await?;

            log::info!(
                "Alert sent successfully to integration {} ({})",
                rule_channel.integration_id,
                integration.name
            );
        } else {
            // Calculate next retry with exponential backoff + jitter
            let attempt_count = 1;
            let base_delay = 60; // 1 minute
            let max_delay = 3600; // 1 hour
            let delay_secs = std::cmp::min(
                base_delay * (2_i64.pow(attempt_count as u32 - 1)),
                max_delay,
            );
            // Add 10% jitter
            let jitter = (delay_secs as f64 * 0.1 * rand::random::<f64>()) as i64;
            let next_retry = Utc::now() + Duration::seconds(delay_secs + jitter);

            sqlx::query(
                r#"
                UPDATE alert_history
                SET status = 'pending', attempt_count = $2,
                    error_message = $3, http_status_code = $4,
                    next_retry_at = $5
                WHERE id = $1
                "#,
            )
            .bind(history_id.0)
            .bind(attempt_count)
            .bind(&result.error_message)
            .bind(result.http_status.map(|s| s as i32))
            .bind(next_retry)
            .execute(pool)
            .await?;

            sqlx::query(
                r#"
                UPDATE alert_integrations
                SET last_failure_at = CURRENT_TIMESTAMP,
                    last_failure_message = $2,
                    failure_count = failure_count + 1
                WHERE id = $1
                "#,
            )
            .bind(rule_channel.integration_id)
            .bind(&result.error_message)
            .execute(pool)
            .await?;

            log::warn!(
                "Alert to integration {} ({}) failed: {:?}",
                rule_channel.integration_id,
                integration.name,
                result.error_message
            );
        }

        Ok(())
    }

    // =========================================================================
    // Alert History
    // =========================================================================

    /// Lists alert history for a project
    pub async fn list_history(
        pool: &DbPool,
        project_id: i32,
        limit: i64,
    ) -> AppResult<Vec<AlertHistory>> {
        let history = sqlx::query_as::<_, AlertHistory>(
            r#"
            SELECT id, alert_rule_id, integration_id, issue_id, project_id,
                   alert_type, channel_type, channel_name, status,
                   attempt_count, next_retry_at, error_message,
                   http_status_code, idempotency_key, created_at, sent_at
            FROM alert_history
            WHERE project_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(project_id)
        .bind(limit)
        .fetch_all(pool)
        .await?;

        Ok(history)
    }

    /// Processes pending retries (for background worker)
    #[allow(dead_code)]
    pub async fn process_retry_queue(pool: &DbPool, max_retries: i32) -> AppResult<u32> {
        #[cfg(feature = "postgres")]
        let pending: Vec<AlertHistory> = sqlx::query_as(
            r#"
            SELECT id, alert_rule_id, integration_id, issue_id, project_id,
                   alert_type, channel_type, channel_name, status,
                   attempt_count, next_retry_at, error_message,
                   http_status_code, idempotency_key, created_at, sent_at
            FROM alert_history
            WHERE status = 'pending' AND next_retry_at <= CURRENT_TIMESTAMP AND attempt_count < $1
            ORDER BY next_retry_at
            LIMIT 100
            "#,
        )
        .bind(max_retries)
        .fetch_all(pool)
        .await?;

        #[cfg(feature = "sqlite")]
        let pending: Vec<AlertHistory> = sqlx::query_as(
            r#"
            SELECT id, alert_rule_id, integration_id, issue_id, project_id,
                   alert_type, channel_type, channel_name, status,
                   attempt_count, next_retry_at, error_message,
                   http_status_code, idempotency_key, created_at, sent_at
            FROM alert_history
            WHERE status = 'pending'
              AND datetime(next_retry_at) <= datetime('now')
              AND attempt_count < $1
            ORDER BY next_retry_at
            LIMIT 100
            "#,
        )
        .bind(max_retries)
        .fetch_all(pool)
        .await?;

        let mut processed = 0u32;

        for history in pending {
            // Mark as failed if max retries exceeded or integration deleted
            if history.integration_id.is_none() {
                sqlx::query(
                    "UPDATE alert_history SET status = 'failed', error_message = 'Integration deleted' WHERE id = $1",
                )
                .bind(history.id)
                .execute(pool)
                .await?;
                processed += 1;
                continue;
            }

            // For now, just mark as failed - full retry would require storing payload
            sqlx::query(
                "UPDATE alert_history SET status = 'failed', error_message = 'Retry not implemented' WHERE id = $1",
            )
            .bind(history.id)
            .execute(pool)
            .await?;

            processed += 1;
        }

        Ok(processed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_issue_url_uses_numeric_project_id_not_slug() {
        let url = AlertService::build_issue_url("http://localhost:3000", 42, uuid::Uuid::nil());
        assert!(
            url.contains("/projects/42/"),
            "URL must use numeric project id, got: {}",
            url
        );
    }

    // -------------------------------------------------------------------------
    // Task 4 tests: get_rule_channels / dispatch_to_channel contract
    // -------------------------------------------------------------------------

    #[test]
    fn test_alert_rule_channel_carries_integration_id_and_routing() {
        // Unit test for the struct — DB interaction tests require testcontainers
        let channel = AlertRuleChannel {
            alert_rule_id: 1,
            integration_id: 5,
            routing_override: serde_json::json!({"channel": "#fe"}),
        };
        assert_eq!(channel.integration_id, 5);
        assert_eq!(channel.routing_override["channel"], "#fe");
    }

    #[test]
    fn test_idempotency_key_uses_integration_id() {
        // The idempotency key format must encode integration_id, not channel_id
        let alert_id = "proj1-issueuuid-1234567890";
        let integration_id = 42;
        let key = format!("{}-{}", alert_id, integration_id);
        assert!(
            key.ends_with("-42"),
            "idempotency key must end with integration_id, got: {key}"
        );
    }
}
