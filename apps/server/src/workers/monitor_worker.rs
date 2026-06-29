use std::time::Duration;

use chrono::Utc;

use crate::db::DbPool;
use crate::services::monitor::MonitorService;

/// Background worker that detects missed and timed-out monitor check-ins.
///
/// Each tick runs [`MonitorService::process_overdue`], which marks overdue
/// monitors `missed` (recording a synthetic check-in) and times out
/// in-progress runs that exceed their `max_runtime`. The detection logic takes
/// an explicit `now`, so it is unit-tested without the loop.
pub struct MonitorWorker {
    pool: DbPool,
    tick_interval_secs: u64,
}

impl MonitorWorker {
    pub fn new(pool: DbPool, tick_interval_secs: u64) -> Self {
        Self {
            pool,
            tick_interval_secs,
        }
    }

    /// Run the worker indefinitely, polling on the configured interval.
    pub async fn run(self) {
        log::info!(
            "Monitor worker starting up (tick every {}s)",
            self.tick_interval_secs
        );
        let mut interval = tokio::time::interval(Duration::from_secs(self.tick_interval_secs));
        loop {
            interval.tick().await;
            match MonitorService::process_overdue(&self.pool, Utc::now()).await {
                Ok(n) if n > 0 => log::info!("Monitor worker: {} monitor(s) marked missed", n),
                Ok(_) => {}
                Err(e) => log::error!("Monitor worker poll error: {:?}", e),
            }
        }
    }
}
