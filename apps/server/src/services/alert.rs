//! Alert service for managing notification channels, rules, and dispatching alerts.
//!
//! This service handles:
//! - CRUD operations for notification channels (global)
//! - CRUD operations for alert rules (per-project)
//! - Alert triggering and dispatching

use chrono::{Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::{
    AlertHistory, AlertPayload, AlertRule, AlertType, CreateAlertRule, CreateNotificationChannel,
    Issue, IssueInfo, NotificationChannel, Project, ProjectInfo, UpdateAlertRule,
    UpdateNotificationChannel,
};
use crate::services::notification::create_dispatcher;

pub struct AlertService;

impl AlertService {
    // =========================================================================
    // Notification Channel CRUD
    // =========================================================================

    /// Lists all notification channels
    pub async fn list_channels(pool: &PgPool) -> AppResult<Vec<NotificationChannel>> {
        let channels = sqlx::query_as::<_, NotificationChannel>(
            r#"
            SELECT id, name, channel_type, config, is_enabled, failure_count,
                   last_failure_at, last_failure_message, last_success_at,
                   created_at, updated_at
            FROM notification_channels
            ORDER BY created_at DESC
            "#,
        )
        .fetch_all(pool)
        .await?;

        Ok(channels)
    }

    /// Gets a notification channel by ID
    pub async fn get_channel(pool: &PgPool, id: i32) -> AppResult<NotificationChannel> {
        sqlx::query_as::<_, NotificationChannel>(
            r#"
            SELECT id, name, channel_type, config, is_enabled, failure_count,
                   last_failure_at, last_failure_message, last_success_at,
                   created_at, updated_at
            FROM notification_channels
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Channel {} not found", id)))
    }

    /// Creates a notification channel
    pub async fn create_channel(
        pool: &PgPool,
        input: CreateNotificationChannel,
    ) -> AppResult<NotificationChannel> {
        // Validate config based on channel type
        let dispatcher = create_dispatcher(input.channel_type);
        dispatcher.validate_config(&input.config)?;

        let channel = sqlx::query_as::<_, NotificationChannel>(
            r#"
            INSERT INTO notification_channels (name, channel_type, config, is_enabled)
            VALUES ($1, $2::text::varchar, $3, $4)
            RETURNING id, name, channel_type, config, is_enabled, failure_count,
                      last_failure_at, last_failure_message, last_success_at,
                      created_at, updated_at
            "#,
        )
        .bind(&input.name)
        .bind(input.channel_type.to_string())
        .bind(&input.config)
        .bind(input.is_enabled)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(ref db_err) = e {
                if db_err.constraint() == Some("notification_channels_name_key") {
                    return AppError::Conflict(format!("Channel '{}' already exists", input.name));
                }
            }
            AppError::Database(e)
        })?;

        Ok(channel)
    }

    /// Updates a notification channel
    pub async fn update_channel(
        pool: &PgPool,
        id: i32,
        input: UpdateNotificationChannel,
    ) -> AppResult<NotificationChannel> {
        let existing = Self::get_channel(pool, id).await?;

        // If config is being updated, validate it
        if let Some(ref config) = input.config {
            let dispatcher = create_dispatcher(existing.channel_type);
            dispatcher.validate_config(config)?;
        }

        let channel = sqlx::query_as::<_, NotificationChannel>(
            r#"
            UPDATE notification_channels
            SET name = COALESCE($2, name),
                config = COALESCE($3, config),
                is_enabled = COALESCE($4, is_enabled),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, name, channel_type, config, is_enabled, failure_count,
                      last_failure_at, last_failure_message, last_success_at,
                      created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&input.name)
        .bind(&input.config)
        .bind(input.is_enabled)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(ref db_err) = e {
                if db_err.constraint() == Some("notification_channels_name_key") {
                    return AppError::Conflict("Channel name already exists".to_string());
                }
            }
            AppError::Database(e)
        })?;

        Ok(channel)
    }

    /// Deletes a notification channel
    pub async fn delete_channel(pool: &PgPool, id: i32) -> AppResult<()> {
        let result = sqlx::query("DELETE FROM notification_channels WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound(format!("Channel {} not found", id)));
        }

        Ok(())
    }

    // =========================================================================
    // Alert Rule CRUD
    // =========================================================================

    /// Lists alert rules for a project
    pub async fn list_rules(pool: &PgPool, project_id: i32) -> AppResult<Vec<AlertRule>> {
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
    pub async fn get_rule(pool: &PgPool, id: i32) -> AppResult<AlertRule> {
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

    /// Gets channel IDs linked to a rule
    pub async fn get_rule_channels(pool: &PgPool, rule_id: i32) -> AppResult<Vec<i32>> {
        let channel_ids: Vec<(i32,)> =
            sqlx::query_as("SELECT channel_id FROM alert_rule_channels WHERE alert_rule_id = $1")
                .bind(rule_id)
                .fetch_all(pool)
                .await?;

        Ok(channel_ids.into_iter().map(|(id,)| id).collect())
    }

    /// Creates an alert rule
    pub async fn create_rule(
        pool: &PgPool,
        project_id: i32,
        input: CreateAlertRule,
    ) -> AppResult<AlertRule> {
        let mut tx = pool.begin().await?;

        let rule = sqlx::query_as::<_, AlertRule>(
            r#"
            INSERT INTO alert_rules (project_id, name, alert_type, conditions, cooldown_minutes)
            VALUES ($1, $2, $3::text::varchar, $4, $5)
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
                if db_err.constraint() == Some("alert_rules_project_id_alert_type_key") {
                    return AppError::Conflict(format!(
                        "Alert rule for type '{}' already exists in this project",
                        input.alert_type
                    ));
                }
            }
            AppError::Database(e)
        })?;

        // Link channels
        for channel_id in &input.channel_ids {
            sqlx::query(
                "INSERT INTO alert_rule_channels (alert_rule_id, channel_id) VALUES ($1, $2)",
            )
            .bind(rule.id)
            .bind(channel_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                if let sqlx::Error::Database(ref db_err) = e {
                    if db_err.is_foreign_key_violation() {
                        return AppError::NotFound(format!("Channel {} not found", channel_id));
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
        pool: &PgPool,
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
                updated_at = NOW()
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
        if let Some(ref channel_ids) = input.channel_ids {
            // Remove existing links
            sqlx::query("DELETE FROM alert_rule_channels WHERE alert_rule_id = $1")
                .bind(id)
                .execute(&mut *tx)
                .await?;

            // Add new links
            for channel_id in channel_ids {
                sqlx::query(
                    "INSERT INTO alert_rule_channels (alert_rule_id, channel_id) VALUES ($1, $2)",
                )
                .bind(id)
                .bind(channel_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| {
                    if let sqlx::Error::Database(ref db_err) = e {
                        if db_err.is_foreign_key_violation() {
                            return AppError::NotFound(format!("Channel {} not found", channel_id));
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
    pub async fn delete_rule(pool: &PgPool, id: i32) -> AppResult<()> {
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
        pool: &PgPool,
        project: &Project,
        issue: &Issue,
        dashboard_url: &str,
    ) -> AppResult<()> {
        Self::trigger_alert(pool, project, issue, AlertType::NewIssue, dashboard_url).await
    }

    /// Triggers an alert for a regression
    #[allow(dead_code)]
    pub async fn trigger_regression_alert(
        pool: &PgPool,
        project: &Project,
        issue: &Issue,
        dashboard_url: &str,
    ) -> AppResult<()> {
        Self::trigger_alert(pool, project, issue, AlertType::Regression, dashboard_url).await
    }

    /// Triggers an alert for an unmute
    #[allow(dead_code)]
    pub async fn trigger_unmute_alert(
        pool: &PgPool,
        project: &Project,
        issue: &Issue,
        dashboard_url: &str,
    ) -> AppResult<()> {
        Self::trigger_alert(pool, project, issue, AlertType::Unmute, dashboard_url).await
    }

    /// Core alert triggering logic
    async fn trigger_alert(
        pool: &PgPool,
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
            WHERE project_id = $1 AND alert_type = $2::text::varchar AND is_enabled = TRUE
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

        // 2. Check cooldown
        if let Some(last_triggered) = rule.last_triggered_at {
            let cooldown = Duration::minutes(rule.cooldown_minutes as i64);
            if Utc::now() - last_triggered < cooldown {
                log::debug!("Alert rule {} is in cooldown period", rule.id);
                return Ok(());
            }
        }

        // 3. Get associated channels
        let channels: Vec<NotificationChannel> = sqlx::query_as(
            r#"
            SELECT nc.id, nc.name, nc.channel_type, nc.config, nc.is_enabled,
                   nc.failure_count, nc.last_failure_at, nc.last_failure_message,
                   nc.last_success_at, nc.created_at, nc.updated_at
            FROM notification_channels nc
            INNER JOIN alert_rule_channels arc ON nc.id = arc.channel_id
            WHERE arc.alert_rule_id = $1 AND nc.is_enabled = TRUE
            "#,
        )
        .bind(rule.id)
        .fetch_all(pool)
        .await?;

        if channels.is_empty() {
            log::debug!("No enabled channels for alert rule {}", rule.id);
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
            issue_url: format!(
                "{}/projects/{}/issues/{}",
                dashboard_url, project.slug, issue.id
            ),
            actor: "Rustrak".to_string(),
        };

        // 5. Update last_triggered_at
        sqlx::query("UPDATE alert_rules SET last_triggered_at = NOW() WHERE id = $1")
            .bind(rule.id)
            .execute(pool)
            .await?;

        log::info!(
            "Triggering {} alert for issue {} in project {}",
            alert_type,
            issue.id,
            project.name
        );

        // 6. Dispatch to all channels (spawn tasks for parallel execution)
        for channel in channels {
            let pool = pool.clone();
            let payload = payload.clone();
            let rule_id = rule.id;

            tokio::spawn(async move {
                if let Err(e) = Self::dispatch_to_channel(&pool, &channel, &payload, rule_id).await
                {
                    log::error!(
                        "Failed to dispatch alert to channel {} ({}): {}",
                        channel.id,
                        channel.name,
                        e
                    );
                }
            });
        }

        Ok(())
    }

    /// Dispatches an alert to a single channel
    async fn dispatch_to_channel(
        pool: &PgPool,
        channel: &NotificationChannel,
        payload: &AlertPayload,
        rule_id: i32,
    ) -> AppResult<()> {
        let idempotency_key = format!("{}-{}", payload.alert_id, channel.id);

        // Check for duplicate (idempotency)
        let existing: Option<(i64,)> =
            sqlx::query_as("SELECT id FROM alert_history WHERE idempotency_key = $1")
                .bind(&idempotency_key)
                .fetch_optional(pool)
                .await?;

        if existing.is_some() {
            log::debug!("Alert {} already processed, skipping", idempotency_key);
            return Ok(());
        }

        // Parse issue_id as UUID
        let issue_uuid = Uuid::parse_str(&payload.issue.id).ok();

        // Create history record
        let history_id: (i64,) = sqlx::query_as(
            r#"
            INSERT INTO alert_history (
                alert_rule_id, channel_id, issue_id, project_id,
                alert_type, channel_type, channel_name,
                status, idempotency_key
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
            RETURNING id
            "#,
        )
        .bind(rule_id)
        .bind(channel.id)
        .bind(issue_uuid)
        .bind(payload.project.id)
        .bind(&payload.alert_type)
        .bind(channel.channel_type.to_string())
        .bind(&channel.name)
        .bind(&idempotency_key)
        .fetch_one(pool)
        .await?;

        // Dispatch using appropriate notifier
        let dispatcher = create_dispatcher(channel.channel_type);
        let result = dispatcher.send(channel, payload).await;

        // Update history and channel stats based on result
        if result.success {
            sqlx::query(
                r#"
                UPDATE alert_history
                SET status = 'sent', sent_at = NOW(), http_status_code = $2
                WHERE id = $1
                "#,
            )
            .bind(history_id.0)
            .bind(result.http_status.map(|s| s as i32))
            .execute(pool)
            .await?;

            sqlx::query(
                r#"
                UPDATE notification_channels
                SET last_success_at = NOW(), failure_count = 0
                WHERE id = $1
                "#,
            )
            .bind(channel.id)
            .execute(pool)
            .await?;

            log::info!(
                "Alert sent successfully to channel {} ({})",
                channel.id,
                channel.name
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
                UPDATE notification_channels
                SET last_failure_at = NOW(),
                    last_failure_message = $2,
                    failure_count = failure_count + 1
                WHERE id = $1
                "#,
            )
            .bind(channel.id)
            .bind(&result.error_message)
            .execute(pool)
            .await?;

            log::warn!(
                "Alert to channel {} ({}) failed: {:?}",
                channel.id,
                channel.name,
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
        pool: &PgPool,
        project_id: i32,
        limit: i64,
    ) -> AppResult<Vec<AlertHistory>> {
        let history = sqlx::query_as::<_, AlertHistory>(
            r#"
            SELECT id, alert_rule_id, channel_id, issue_id, project_id,
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
    pub async fn process_retry_queue(pool: &PgPool, max_retries: i32) -> AppResult<u32> {
        let pending: Vec<AlertHistory> = sqlx::query_as(
            r#"
            SELECT id, alert_rule_id, channel_id, issue_id, project_id,
                   alert_type, channel_type, channel_name, status,
                   attempt_count, next_retry_at, error_message,
                   http_status_code, idempotency_key, created_at, sent_at
            FROM alert_history
            WHERE status = 'pending' AND next_retry_at <= NOW() AND attempt_count < $1
            ORDER BY next_retry_at
            LIMIT 100
            "#,
        )
        .bind(max_retries)
        .fetch_all(pool)
        .await?;

        let mut processed = 0u32;

        for history in pending {
            // Mark as failed if max retries exceeded or channel deleted
            if history.channel_id.is_none() {
                sqlx::query(
                    "UPDATE alert_history SET status = 'failed', error_message = 'Channel deleted' WHERE id = $1",
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
