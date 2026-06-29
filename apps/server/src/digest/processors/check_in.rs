use super::{Processor, ProcessorCtx};
use crate::error::AppResult;
use crate::models::check_in::CheckInPayload;
use sqlx::Row;
use uuid::Uuid;

/// Processor for monitor check-ins (Sentry Crons "check_in" item type).
///
/// Upserts the monitor by `(project_id, slug)` and records the check-in.
/// Mirrors Relay's `CheckInsProcessor` minus the Relay-only concerns
/// (rate limiting by category, Kafka forwarding) — Rustrak is the terminal
/// store. Missed/timeout detection is handled by a separate background worker.
pub struct CheckInProcessor;

impl Processor for CheckInProcessor {
    type Input = Vec<u8>;

    async fn process(&self, work: Vec<u8>, ctx: &ProcessorCtx) -> AppResult<()> {
        let mut check_in = CheckInPayload::parse(&work)?;
        check_in.normalize()?;

        // Decompose the optional schedule config into nullable columns. A
        // check-in without config carries all-NULL here; COALESCE on update
        // then preserves any config a previous check-in already provisioned.
        let (sched_type, sched_value, sched_unit, margin, max_runtime, timezone, owner) =
            match &check_in.monitor_config {
                Some(cfg) => {
                    let (t, v, u) = cfg.schedule.to_columns();
                    (
                        Some(t),
                        Some(v),
                        u,
                        cfg.checkin_margin,
                        cfg.max_runtime,
                        cfg.timezone.clone(),
                        cfg.owner.clone(),
                    )
                }
                None => (None, None, None, None, None, None, None),
            };

        let mut tx = ctx.pool.begin().await?;

        // Upsert the monitor, then read its id. Two statements keep the SQL
        // dialect-safe (RETURNING differs across Postgres/SQLite versions).
        sqlx::query(
            r#"
            INSERT INTO monitors (
                id, project_id, slug,
                schedule_type, schedule_value, schedule_unit,
                checkin_margin, max_runtime, timezone, owner,
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (project_id, slug) DO UPDATE SET
                schedule_type  = COALESCE(EXCLUDED.schedule_type,  monitors.schedule_type),
                schedule_value = COALESCE(EXCLUDED.schedule_value, monitors.schedule_value),
                schedule_unit  = COALESCE(EXCLUDED.schedule_unit,  monitors.schedule_unit),
                checkin_margin = COALESCE(EXCLUDED.checkin_margin, monitors.checkin_margin),
                max_runtime    = COALESCE(EXCLUDED.max_runtime,    monitors.max_runtime),
                timezone       = COALESCE(EXCLUDED.timezone,       monitors.timezone),
                owner          = COALESCE(EXCLUDED.owner,          monitors.owner),
                updated_at     = EXCLUDED.updated_at
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(ctx.project_id)
        .bind(&check_in.monitor_slug)
        .bind(sched_type)
        .bind(sched_value)
        .bind(sched_unit)
        .bind(margin)
        .bind(max_runtime)
        .bind(timezone)
        .bind(owner)
        .bind(ctx.ingested_at)
        .execute(&mut *tx)
        .await?;

        let monitor_row =
            sqlx::query("SELECT id, schedule_type, schedule_value, schedule_unit, timezone FROM monitors WHERE project_id = $1 AND slug = $2")
                .bind(ctx.project_id)
                .bind(&check_in.monitor_slug)
                .fetch_one(&mut *tx)
                .await?;
        let monitor_id: Uuid = monitor_row.get("id");

        // Recompute the next expected check-in from the (possibly just-upserted)
        // schedule, so the missed worker always has a current deadline.
        let next_expected_at = monitor_row
            .get::<Option<String>, _>("schedule_type")
            .and_then(|st| {
                let sv: Option<String> = monitor_row.get("schedule_value");
                let su: Option<String> = monitor_row.get("schedule_unit");
                let tz: Option<String> = monitor_row.get("timezone");
                crate::services::monitor::next_expected_after(
                    &st,
                    sv.as_deref().unwrap_or_default(),
                    su.as_deref(),
                    tz.as_deref(),
                    ctx.ingested_at,
                )
            });

        // Lifecycle: a closing check-in (ok/error) carries the same check_in_id
        // as its in_progress open. Update the open row in place rather than
        // recording a duplicate. An id-less check-in is always a fresh row.
        let check_in_id = parse_check_in_id(&check_in.check_in_id);
        let updated = if let Some(cid) = check_in_id {
            sqlx::query(
                r#"
                UPDATE check_ins SET
                    status      = $1,
                    duration    = COALESCE($2, duration),
                    environment = COALESCE($3, environment),
                    timestamp   = $4
                WHERE monitor_id = $5 AND check_in_id = $6
                "#,
            )
            .bind(check_in.status.as_str())
            .bind(check_in.duration)
            .bind(check_in.environment.as_deref())
            .bind(ctx.ingested_at)
            .bind(monitor_id)
            .bind(cid)
            .execute(&mut *tx)
            .await?
            .rows_affected()
                > 0
        } else {
            false
        };

        if !updated {
            sqlx::query(
                r#"
                INSERT INTO check_ins (
                    id, monitor_id, project_id, check_in_id,
                    status, duration, environment, trace_id,
                    timestamp, ingested_at
                ) VALUES (
                    $1, $2, $3, $4,
                    $5, $6, $7, $8,
                    $9, $10
                )
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(monitor_id)
            .bind(ctx.project_id)
            .bind(check_in_id)
            .bind(check_in.status.as_str())
            .bind(check_in.duration)
            .bind(check_in.environment.as_deref())
            .bind(None::<String>)
            .bind(ctx.ingested_at)
            .bind(ctx.ingested_at)
            .execute(&mut *tx)
            .await?;
        }

        // Maintain the monitor's derived state. A terminal status (ok/error)
        // becomes the monitor's status; in_progress/unknown leave it untouched
        // (the missed worker owns timeout/missed transitions).
        let status = check_in.status.as_str();
        sqlx::query(
            r#"
            UPDATE monitors SET
                last_check_in_at     = $1,
                last_check_in_status = $2,
                status = CASE WHEN $3 IN ('ok', 'error') THEN $4 ELSE status END,
                next_expected_at = COALESCE($5, next_expected_at),
                updated_at = $6
            WHERE id = $7
            "#,
        )
        .bind(ctx.ingested_at)
        .bind(status)
        .bind(status)
        .bind(status)
        .bind(next_expected_at)
        .bind(ctx.ingested_at)
        .bind(monitor_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
    }
}

/// Parses the SDK-provided check-in id, dropping a nil or unparseable value
/// (those carry no lifecycle meaning).
fn parse_check_in_id(raw: &Option<String>) -> Option<Uuid> {
    raw.as_deref()
        .and_then(|s| Uuid::parse_str(s).ok())
        .filter(|u| !u.is_nil())
}
