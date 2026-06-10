use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, NaiveDate, Timelike, Utc};
use tokio::sync::Mutex;

use crate::db::DbPool;
use crate::models::session::{
    classify, parse_ts, SessionAggregateItem, SessionAggregates, SessionOutcome, SessionStatus,
    SessionUpdate,
};

const OVERFLOW_RELEASE: &str = "<overflow>";

/// Key identifying a minute-bucketed session count row.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct BucketKey {
    pub project_id: i32,
    pub release: String,
    pub environment: String,
    pub bucket: DateTime<Utc>,
}

/// Aggregated counters for a bucket key.
#[derive(Debug, Default, Clone)]
pub struct Counters {
    pub total: i64,
    pub errored: i64,
    pub crashed: i64,
    pub abnormal: i64,
}

/// Key identifying a day-bucketed distinct-user row.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct UserKey {
    pub project_id: i32,
    pub release: String,
    pub environment: String,
    pub day: NaiveDate,
    pub did: String,
}

/// State held under the mutex.
#[derive(Debug, Default)]
pub struct AggregatorState {
    pub counts: HashMap<BucketKey, Counters>,
    /// Map of UserKey → crashed; TRUE means this user had a crash this flush cycle.
    pub users: HashMap<UserKey, bool>,
}

/// Shared handle to the session aggregator — cheaply cloneable across handlers.
#[derive(Clone)]
pub struct SessionAggregatorHandle(Arc<SessionAggregator>);

impl SessionAggregatorHandle {
    pub async fn ingest_session(&self, project_id: i32, update: &SessionUpdate) {
        self.0.ingest_session(project_id, update).await;
    }

    pub async fn ingest_aggregates(&self, project_id: i32, agg: &SessionAggregates) {
        self.0.ingest_aggregates(project_id, agg).await;
    }

    /// Flush all in-memory state to DB.  Called on shutdown.
    pub async fn flush(&self) {
        self.0.flush().await;
    }
}

pub struct SessionAggregator {
    pool: DbPool,
    state: Mutex<AggregatorState>,
    flush_interval_secs: u64,
    cardinality_cap: usize,
}

impl SessionAggregator {
    pub fn new(
        pool: DbPool,
        flush_interval_secs: u64,
        cardinality_cap: usize,
    ) -> SessionAggregatorHandle {
        let agg = Arc::new(Self {
            pool,
            state: Mutex::new(AggregatorState::default()),
            flush_interval_secs,
            cardinality_cap,
        });
        SessionAggregatorHandle(agg)
    }

    /// Ingest a single `session` envelope item.
    pub async fn ingest_session(&self, project_id: i32, update: &SessionUpdate) {
        let attrs = match &update.attrs {
            Some(a) => a,
            None => {
                log::warn!("session item missing attrs, dropping");
                return;
            }
        };
        let release = match &attrs.release {
            Some(r) if !r.is_empty() => r.clone(),
            _ => {
                log::warn!("session item missing release, dropping");
                return;
            }
        };
        let environment = attrs.environment.clone().unwrap_or_default();

        let started_str = update.started.as_deref().unwrap_or("");
        let bucket = match parse_ts(started_str) {
            Some(dt) => truncate_to_minute(dt),
            None => truncate_to_minute(Utc::now()),
        };

        let mut state = self.state.lock().await;
        let release = apply_cardinality_cap(&state, project_id, release, self.cardinality_cap);

        let key = BucketKey {
            project_id,
            release: release.clone(),
            environment: environment.clone(),
            bucket,
        };

        if update.init {
            let entry = state.counts.entry(key).or_default();
            entry.total += 1;

            if let Some(did) = &update.did {
                if !did.is_empty() {
                    let day = bucket.date_naive();
                    let ukey = UserKey {
                        project_id,
                        release: release.clone(),
                        environment: environment.clone(),
                        day,
                        did: did.clone(),
                    };
                    state.users.entry(ukey).or_insert(false);
                }
            }
        }

        let status = update.status.as_ref().cloned().unwrap_or(SessionStatus::Ok);
        if status.is_terminal() {
            let outcome = classify(&status, update.errors);
            let key = BucketKey {
                project_id,
                release: release.clone(),
                environment: environment.clone(),
                bucket,
            };
            let entry = state.counts.entry(key).or_default();
            match outcome {
                SessionOutcome::Crashed => {
                    entry.crashed += 1;
                    if let Some(did) = &update.did {
                        if !did.is_empty() {
                            let day = bucket.date_naive();
                            let ukey = UserKey {
                                project_id,
                                release,
                                environment,
                                day,
                                did: did.clone(),
                            };
                            state.users.insert(ukey, true);
                        }
                    }
                }
                SessionOutcome::Abnormal => entry.abnormal += 1,
                SessionOutcome::Errored => entry.errored += 1,
                SessionOutcome::Healthy => {}
            }
        }
    }

    /// Ingest a pre-aggregated `sessions` envelope item.
    pub async fn ingest_aggregates(&self, project_id: i32, agg: &SessionAggregates) {
        let attrs = match &agg.attrs {
            Some(a) => a,
            None => {
                log::warn!("sessions item missing attrs, dropping");
                return;
            }
        };
        let release = match &attrs.release {
            Some(r) if !r.is_empty() => r.clone(),
            _ => {
                log::warn!("sessions item missing release, dropping");
                return;
            }
        };
        let environment = attrs.environment.clone().unwrap_or_default();

        let mut state = self.state.lock().await;
        let release = apply_cardinality_cap(&state, project_id, release, self.cardinality_cap);

        for item in &agg.aggregates {
            apply_aggregate_item(&mut state, project_id, &release, &environment, item);
        }
    }

    /// Flush all in-memory counters to the DB via batched UPSERT.
    pub async fn flush(&self) {
        let (counts, users) = {
            let mut state = self.state.lock().await;
            let counts = std::mem::take(&mut state.counts);
            let users = std::mem::take(&mut state.users);
            (counts, users)
        };

        if counts.is_empty() && users.is_empty() {
            return;
        }

        for (key, c) in &counts {
            if let Err(e) = self.upsert_count(key, c).await {
                log::error!("session_aggregator: flush_counts error: {:?}", e);
            }
        }
        for (key, &crashed) in &users {
            if let Err(e) = self.upsert_user(key, crashed).await {
                log::error!("session_aggregator: flush_users error: {:?}", e);
            }
        }
    }

    async fn upsert_count(&self, key: &BucketKey, c: &Counters) -> Result<(), sqlx::Error> {
        #[cfg(feature = "postgres")]
        sqlx::query(
            r#"
            INSERT INTO session_counts (project_id, release, environment, bucket, total, errored, crashed, abnormal)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (project_id, release, environment, bucket)
            DO UPDATE SET
                total    = session_counts.total    + EXCLUDED.total,
                errored  = session_counts.errored  + EXCLUDED.errored,
                crashed  = session_counts.crashed  + EXCLUDED.crashed,
                abnormal = session_counts.abnormal + EXCLUDED.abnormal
            "#,
        )
        .bind(key.project_id)
        .bind(&key.release)
        .bind(&key.environment)
        .bind(key.bucket)
        .bind(c.total)
        .bind(c.errored)
        .bind(c.crashed)
        .bind(c.abnormal)
        .execute(&self.pool)
        .await?;

        #[cfg(not(feature = "postgres"))]
        sqlx::query(
            r#"
            INSERT INTO session_counts (project_id, release, environment, bucket, total, errored, crashed, abnormal)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT (project_id, release, environment, bucket)
            DO UPDATE SET
                total    = session_counts.total    + excluded.total,
                errored  = session_counts.errored  + excluded.errored,
                crashed  = session_counts.crashed  + excluded.crashed,
                abnormal = session_counts.abnormal + excluded.abnormal
            "#,
        )
        .bind(key.project_id)
        .bind(&key.release)
        .bind(&key.environment)
        .bind(key.bucket.naive_utc().to_string())
        .bind(c.total)
        .bind(c.errored)
        .bind(c.crashed)
        .bind(c.abnormal)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn upsert_user(&self, key: &UserKey, crashed: bool) -> Result<(), sqlx::Error> {
        #[cfg(feature = "postgres")]
        sqlx::query(
            r#"
            INSERT INTO session_users (project_id, release, environment, day, did, crashed)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (project_id, release, environment, day, did)
            DO UPDATE SET crashed = session_users.crashed OR EXCLUDED.crashed
            "#,
        )
        .bind(key.project_id)
        .bind(&key.release)
        .bind(&key.environment)
        .bind(key.day)
        .bind(&key.did)
        .bind(crashed)
        .execute(&self.pool)
        .await?;

        #[cfg(not(feature = "postgres"))]
        sqlx::query(
            r#"
            INSERT INTO session_users (project_id, release, environment, day, did, crashed)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT (project_id, release, environment, day, did)
            DO UPDATE SET crashed = MAX(session_users.crashed, excluded.crashed)
            "#,
        )
        .bind(key.project_id)
        .bind(&key.release)
        .bind(&key.environment)
        .bind(key.day.to_string())
        .bind(&key.did)
        .bind(if crashed { 1i64 } else { 0i64 })
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Run the aggregator interval loop.  Pass the handle here; it owns the Arc.
    pub async fn run(handle: SessionAggregatorHandle) {
        log::info!("session_aggregator: started");
        let interval_secs = handle.0.flush_interval_secs;
        let mut interval = tokio::time::interval(Duration::from_secs(interval_secs));
        interval.tick().await; // consume the immediate first tick
        loop {
            interval.tick().await;
            handle.0.flush().await;
        }
    }
}

pub fn truncate_to_minute(dt: DateTime<Utc>) -> DateTime<Utc> {
    dt.with_second(0)
        .and_then(|d| d.with_nanosecond(0))
        .unwrap_or(dt)
}

/// Apply cardinality cap: if the new release would exceed the per-project cap, use OVERFLOW_RELEASE.
pub fn apply_cardinality_cap(
    state: &AggregatorState,
    project_id: i32,
    release: String,
    cap: usize,
) -> String {
    let project_releases: std::collections::HashSet<&str> = state
        .counts
        .keys()
        .filter(|k| k.project_id == project_id)
        .map(|k| k.release.as_str())
        .collect();

    if project_releases.contains(release.as_str()) {
        return release;
    }
    if project_releases.len() >= cap {
        return OVERFLOW_RELEASE.to_string();
    }
    release
}

/// Apply a pre-aggregated item into state (pure, no I/O).
pub fn apply_aggregate_item(
    state: &mut AggregatorState,
    project_id: i32,
    release: &str,
    environment: &str,
    item: &SessionAggregateItem,
) {
    let started_str = item.started.as_deref().unwrap_or("");
    let bucket = match parse_ts(started_str) {
        Some(dt) => truncate_to_minute(dt),
        None => truncate_to_minute(Utc::now()),
    };

    let key = BucketKey {
        project_id,
        release: release.to_string(),
        environment: environment.to_string(),
        bucket,
    };
    let entry = state.counts.entry(key).or_default();
    entry.total += item.exited + item.errored + item.crashed + item.abnormal;
    entry.errored += item.errored;
    entry.crashed += item.crashed;
    entry.abnormal += item.abnormal;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::session::{SessionAttributes, SessionStatus};

    fn make_update(
        init: bool,
        status: SessionStatus,
        errors: i64,
        did: Option<&str>,
    ) -> SessionUpdate {
        SessionUpdate {
            sid: Some("sid-1".to_string()),
            did: did.map(|s| s.to_string()),
            seq: Some(0),
            init,
            started: Some("2026-06-10T10:00:00.000Z".to_string()),
            timestamp: None,
            duration: None,
            status: Some(status),
            errors,
            attrs: Some(SessionAttributes {
                release: Some("1.0.0".to_string()),
                environment: Some("production".to_string()),
            }),
        }
    }

    /// Pure bucketing helper for tests — no DB pool needed.
    fn apply_update(state: &mut AggregatorState, project_id: i32, update: &SessionUpdate) {
        let attrs = update.attrs.as_ref().unwrap();
        let release = attrs.release.clone().unwrap();
        let environment = attrs.environment.clone().unwrap_or_default();
        let bucket = parse_ts(update.started.as_deref().unwrap_or(""))
            .map(truncate_to_minute)
            .unwrap_or_else(|| truncate_to_minute(Utc::now()));

        let release = apply_cardinality_cap(state, project_id, release, 10_000);

        let key = BucketKey {
            project_id,
            release: release.clone(),
            environment: environment.clone(),
            bucket,
        };

        if update.init {
            state.counts.entry(key.clone()).or_default().total += 1;
            if let Some(did) = &update.did {
                if !did.is_empty() {
                    let ukey = UserKey {
                        project_id,
                        release: release.clone(),
                        environment: environment.clone(),
                        day: bucket.date_naive(),
                        did: did.clone(),
                    };
                    state.users.entry(ukey).or_insert(false);
                }
            }
        }

        let status = update.status.as_ref().cloned().unwrap_or(SessionStatus::Ok);
        if status.is_terminal() {
            let outcome = classify(&status, update.errors);
            let entry = state.counts.entry(key).or_default();
            match outcome {
                SessionOutcome::Crashed => {
                    entry.crashed += 1;
                    if let Some(did) = &update.did {
                        if !did.is_empty() {
                            let ukey = UserKey {
                                project_id,
                                release,
                                environment,
                                day: bucket.date_naive(),
                                did: did.clone(),
                            };
                            state.users.insert(ukey, true);
                        }
                    }
                }
                SessionOutcome::Abnormal => entry.abnormal += 1,
                SessionOutcome::Errored => entry.errored += 1,
                SessionOutcome::Healthy => {}
            }
        }
    }

    #[test]
    fn truncate_removes_seconds() {
        use chrono::TimeZone;
        let dt = Utc.with_ymd_and_hms(2026, 6, 10, 10, 5, 42).unwrap();
        let t = truncate_to_minute(dt);
        assert_eq!(t.second(), 0);
        assert_eq!(t.minute(), 5);
    }

    #[test]
    fn init_increments_total() {
        let mut state = AggregatorState::default();
        apply_update(
            &mut state,
            1,
            &make_update(true, SessionStatus::Ok, 0, None),
        );
        let c = state.counts.values().next().unwrap();
        assert_eq!(c.total, 1);
        assert_eq!(c.crashed, 0);
    }

    #[test]
    fn heartbeat_no_double_count() {
        let mut state = AggregatorState::default();
        apply_update(
            &mut state,
            1,
            &make_update(true, SessionStatus::Ok, 0, None),
        );
        apply_update(
            &mut state,
            1,
            &make_update(false, SessionStatus::Ok, 0, None),
        );
        let c = state.counts.values().next().unwrap();
        assert_eq!(c.total, 1, "heartbeat must not increment total");
    }

    #[test]
    fn crash_increments_crashed_and_marks_user() {
        let mut state = AggregatorState::default();
        apply_update(
            &mut state,
            1,
            &make_update(true, SessionStatus::Ok, 0, Some("u1")),
        );
        apply_update(
            &mut state,
            1,
            &make_update(false, SessionStatus::Crashed, 0, Some("u1")),
        );
        let c = state.counts.values().next().unwrap();
        assert_eq!(c.crashed, 1);
        assert_eq!(c.total, 1);
        let crashed = *state.users.values().next().unwrap();
        assert!(crashed);
    }

    #[test]
    fn errored_by_errors_count() {
        let mut state = AggregatorState::default();
        apply_update(
            &mut state,
            1,
            &make_update(true, SessionStatus::Ok, 0, None),
        );
        apply_update(
            &mut state,
            1,
            &make_update(false, SessionStatus::Exited, 3, None),
        );
        let c = state.counts.values().next().unwrap();
        assert_eq!(c.errored, 1);
        assert_eq!(c.crashed, 0);
    }

    #[test]
    fn pre_aggregated_sums_correctly() {
        let mut state = AggregatorState::default();
        let item = SessionAggregateItem {
            started: Some("2026-06-10T10:00:00.000Z".to_string()),
            exited: 5,
            errored: 2,
            crashed: 1,
            abnormal: 0,
        };
        apply_aggregate_item(&mut state, 1, "2.0.0", "staging", &item);
        let c = state.counts.values().next().unwrap();
        assert_eq!(c.total, 8); // 5+2+1+0
        assert_eq!(c.errored, 2);
        assert_eq!(c.crashed, 1);
    }

    #[test]
    fn cardinality_cap_overflows() {
        let mut state = AggregatorState::default();
        // Fill up to cap
        for i in 0..3usize {
            let key = BucketKey {
                project_id: 1,
                release: format!("v{i}"),
                environment: "prod".to_string(),
                bucket: Utc::now(),
            };
            state.counts.insert(key, Counters::default());
        }
        // Cap = 3; next release should overflow
        let result = apply_cardinality_cap(&state, 1, "v99".to_string(), 3);
        assert_eq!(result, OVERFLOW_RELEASE);
    }

    #[test]
    fn cardinality_cap_allows_existing_release() {
        let mut state = AggregatorState::default();
        let key = BucketKey {
            project_id: 1,
            release: "v1.0.0".to_string(),
            environment: "prod".to_string(),
            bucket: Utc::now(),
        };
        state.counts.insert(key, Counters::default());
        let result = apply_cardinality_cap(&state, 1, "v1.0.0".to_string(), 1);
        assert_eq!(result, "v1.0.0");
    }
}
