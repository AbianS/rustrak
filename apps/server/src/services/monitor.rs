//! Monitor service for uptime monitoring CRUD and validation.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

use chrono::Utc;
use uuid::Uuid;

use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::monitor::{CheckType, CreateMonitor, Monitor, MonitorState, UpdateMonitor};

pub struct MonitorService;

// =============================================================================
// Input bounds validation
// =============================================================================

/// Validates that monitor configuration values are within acceptable ranges.
///
/// - interval_secs: 30–86400
/// - timeout_secs: 1–60
/// - fail_threshold: 1–5
/// - recovery_threshold: 1–5
pub fn validate_monitor_bounds(
    interval_secs: i32,
    timeout_secs: i32,
    fail_threshold: i32,
    recovery_threshold: i32,
) -> AppResult<()> {
    if !(30..=86400).contains(&interval_secs) {
        return Err(AppError::Validation(format!(
            "interval_secs must be between 30 and 86400, got {interval_secs}"
        )));
    }
    if !(1..=60).contains(&timeout_secs) {
        return Err(AppError::Validation(format!(
            "timeout_secs must be between 1 and 60, got {timeout_secs}"
        )));
    }
    if !(1..=5).contains(&fail_threshold) {
        return Err(AppError::Validation(format!(
            "fail_threshold must be between 1 and 5, got {fail_threshold}"
        )));
    }
    if !(1..=5).contains(&recovery_threshold) {
        return Err(AppError::Validation(format!(
            "recovery_threshold must be between 1 and 5, got {recovery_threshold}"
        )));
    }
    Ok(())
}

pub fn validate_repeat_interval(repeat_interval_secs: i32) -> AppResult<()> {
    if repeat_interval_secs < 1 {
        return Err(AppError::Validation(format!(
            "repeat_interval_secs must be at least 1, got {repeat_interval_secs}"
        )));
    }
    Ok(())
}

// =============================================================================
// SSRF prevention
// =============================================================================

/// Returns true if the given IPv4 address falls within a reserved/private range.
fn is_ipv4_reserved(ip: Ipv4Addr) -> bool {
    let octets = ip.octets();

    // 10.0.0.0/8
    if octets[0] == 10 {
        return true;
    }
    // 172.16.0.0/12 (172.16.x.x – 172.31.x.x)
    if octets[0] == 172 && (16..=31).contains(&octets[1]) {
        return true;
    }
    // 192.168.0.0/16
    if octets[0] == 192 && octets[1] == 168 {
        return true;
    }
    // 127.0.0.0/8 (loopback)
    if octets[0] == 127 {
        return true;
    }
    // 169.254.0.0/16 (link-local / AWS metadata)
    if octets[0] == 169 && octets[1] == 254 {
        return true;
    }
    // 100.64.0.0/10 (CGNAT)
    if octets[0] == 100 && (64..=127).contains(&octets[1]) {
        return true;
    }
    // 0.0.0.0/8
    if octets[0] == 0 {
        return true;
    }

    false
}

/// Returns true if the given IPv6 address is a loopback, link-local, ULA, or IPv4-mapped reserved.
fn is_ipv6_reserved(ip: Ipv6Addr) -> bool {
    // ::1 loopback
    if ip == Ipv6Addr::LOCALHOST {
        return true;
    }
    let segments = ip.segments();
    // fe80::/10 link-local
    if (segments[0] & 0xffc0) == 0xfe80 {
        return true;
    }
    // fc00::/7 Unique Local Address (IPv6 equivalent of RFC-1918)
    if (segments[0] & 0xfe00) == 0xfc00 {
        return true;
    }
    // ::ffff:0:0/96 IPv4-mapped — check the embedded IPv4 address
    if let Some(ipv4) = ip.to_ipv4_mapped() {
        if is_ipv4_reserved(ipv4) {
            return true;
        }
    }
    false
}

fn is_ip_reserved(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => is_ipv4_reserved(v4),
        IpAddr::V6(v6) => is_ipv6_reserved(v6),
    }
}

/// Validates a monitor URL for SSRF prevention.
///
/// HTTP/HTTPS: parses the URL, resolves the host (via ToSocketAddrs), and
/// rejects any IP address that falls into a private/reserved range.
///
/// TCP: expects "host:port" format, rejects out-of-range port numbers.
pub async fn validate_monitor_url(url: &str, check_type: &CheckType) -> AppResult<()> {
    match check_type {
        CheckType::Http => {
            let parsed = url::Url::parse(url)
                .map_err(|_| AppError::Validation(format!("Invalid URL format: {url}")))?;

            let scheme = parsed.scheme();
            if scheme != "http" && scheme != "https" {
                return Err(AppError::Validation(
                    "HTTP monitors must use http or https scheme".to_string(),
                ));
            }

            let host = parsed
                .host_str()
                .ok_or_else(|| AppError::Validation("URL must contain a host".to_string()))?;

            // If the host is already an IP, check it directly without DNS.
            if let Ok(ip) = host.parse::<IpAddr>() {
                if is_ip_reserved(ip) {
                    return Err(AppError::Validation(format!(
                        "URL host resolves to a reserved/private IP address: {ip}"
                    )));
                }
                return Ok(());
            }

            // Attempt DNS resolution (blocking, wrapped in spawn_blocking).
            let port = parsed
                .port()
                .unwrap_or(if scheme == "https" { 443 } else { 80 });
            let addr_str = format!("{host}:{port}");

            let resolved = tokio::task::spawn_blocking(move || {
                use std::net::ToSocketAddrs;
                addr_str
                    .to_socket_addrs()
                    .map(|iter| iter.collect::<Vec<_>>())
            })
            .await
            .map_err(|e| AppError::Internal(format!("spawn_blocking failed: {e}")))?;

            match resolved {
                Err(_) => {
                    // DNS resolution failed — let it through with a warning.
                    // The probe will fail at runtime. We only block known-bad IPs.
                    log::warn!(
                        "DNS resolution failed for {host}, allowing (will fail at probe time)"
                    );
                    Ok(())
                }
                Ok(addrs) => {
                    for addr in addrs {
                        if is_ip_reserved(addr.ip()) {
                            return Err(AppError::Validation(format!(
                                "URL host resolves to a reserved/private IP address: {}",
                                addr.ip()
                            )));
                        }
                    }
                    Ok(())
                }
            }
        }

        CheckType::Tcp => {
            // Expect "host:port"
            let colon_pos = url.rfind(':').ok_or_else(|| {
                AppError::Validation("TCP monitor url must be in 'host:port' format".to_string())
            })?;

            let host = &url[..colon_pos];
            let port_str = &url[colon_pos + 1..];
            let port: u32 = port_str.parse().map_err(|_| {
                AppError::Validation(format!(
                    "TCP monitor port must be a number, got: {port_str}"
                ))
            })?;

            if port == 0 || port > 65535 {
                return Err(AppError::Validation(format!(
                    "TCP monitor port must be between 1 and 65535, got {port}"
                )));
            }

            // SSRF prevention: same IP check as HTTP branch
            if let Ok(ip) = host.parse::<IpAddr>() {
                if is_ip_reserved(ip) {
                    return Err(AppError::Validation(format!(
                        "TCP monitor host resolves to a reserved/private IP address: {ip}"
                    )));
                }
            } else {
                let host = host.to_string();
                let addr_str = format!("{host}:{port}");
                let resolved = tokio::task::spawn_blocking(move || {
                    use std::net::ToSocketAddrs;
                    addr_str
                        .to_socket_addrs()
                        .map(|iter| iter.collect::<Vec<_>>())
                })
                .await
                .map_err(|e| AppError::Internal(format!("spawn_blocking failed: {e}")))?;

                match resolved {
                    Err(_) => {
                        log::warn!(
                            "DNS resolution failed for {host}, allowing (will fail at probe time)"
                        );
                    }
                    Ok(addrs) => {
                        for addr in addrs {
                            if is_ip_reserved(addr.ip()) {
                                return Err(AppError::Validation(format!(
                                    "TCP monitor host resolves to a reserved/private IP address: {}",
                                    addr.ip()
                                )));
                            }
                        }
                    }
                }
            }

            Ok(())
        }
    }
}

// =============================================================================
// MonitorService
// =============================================================================

impl MonitorService {
    /// Lists all monitors
    pub async fn list(pool: &DbPool) -> AppResult<Vec<Monitor>> {
        let monitors = sqlx::query_as::<_, Monitor>(
            r#"
            SELECT id, name, check_type, url, interval_secs, timeout_secs,
                   expected_status, fail_threshold, recovery_threshold,
                   repeat_interval_secs, enabled, created_at, updated_at
            FROM monitors
            ORDER BY created_at DESC
            "#,
        )
        .fetch_all(pool)
        .await?;

        Ok(monitors)
    }

    /// Gets a monitor by ID
    pub async fn get(pool: &DbPool, id: Uuid) -> AppResult<Monitor> {
        sqlx::query_as::<_, Monitor>(
            r#"
            SELECT id, name, check_type, url, interval_secs, timeout_secs,
                   expected_status, fail_threshold, recovery_threshold,
                   repeat_interval_secs, enabled, created_at, updated_at
            FROM monitors
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Monitor {id} not found")))
    }

    /// Creates a new monitor with validation
    pub async fn create(pool: &DbPool, dto: CreateMonitor) -> AppResult<Monitor> {
        let interval_secs = dto.interval_secs.unwrap_or(60);
        let timeout_secs = dto.timeout_secs.unwrap_or(10);
        let fail_threshold = dto.fail_threshold.unwrap_or(2);
        let recovery_threshold = dto.recovery_threshold.unwrap_or(2);
        let repeat_interval_secs = dto.repeat_interval_secs.unwrap_or(3600);

        // Validate bounds
        validate_monitor_bounds(
            interval_secs,
            timeout_secs,
            fail_threshold,
            recovery_threshold,
        )?;
        validate_repeat_interval(repeat_interval_secs)?;

        // Parse check_type
        let check_type =
            CheckType::try_from(dto.check_type.as_str()).map_err(AppError::Validation)?;

        // Validate URL (SSRF prevention)
        validate_monitor_url(&dto.url, &check_type).await?;

        let monitor_id = Uuid::new_v4();
        let now = Utc::now();

        let mut tx = pool.begin().await?;

        // Insert monitor
        #[cfg(feature = "postgres")]
        let monitor = sqlx::query_as::<_, Monitor>(
            r#"
            INSERT INTO monitors (id, name, check_type, url, interval_secs, timeout_secs,
                                  expected_status, fail_threshold, recovery_threshold,
                                  repeat_interval_secs, enabled, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11, $12)
            RETURNING id, name, check_type, url, interval_secs, timeout_secs,
                      expected_status, fail_threshold, recovery_threshold,
                      repeat_interval_secs, enabled, created_at, updated_at
            "#,
        )
        .bind(monitor_id)
        .bind(&dto.name)
        .bind(&dto.check_type)
        .bind(&dto.url)
        .bind(interval_secs)
        .bind(timeout_secs)
        .bind(dto.expected_status)
        .bind(fail_threshold)
        .bind(recovery_threshold)
        .bind(repeat_interval_secs)
        .bind(now)
        .bind(now)
        .fetch_one(&mut *tx)
        .await?;

        #[cfg(feature = "sqlite")]
        let monitor = {
            sqlx::query(
                r#"
                INSERT INTO monitors (id, name, check_type, url, interval_secs, timeout_secs,
                                      expected_status, fail_threshold, recovery_threshold,
                                      repeat_interval_secs, enabled, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, $11, $12)
                "#,
            )
            .bind(monitor_id.to_string())
            .bind(&dto.name)
            .bind(&dto.check_type)
            .bind(&dto.url)
            .bind(interval_secs)
            .bind(timeout_secs)
            .bind(dto.expected_status)
            .bind(fail_threshold)
            .bind(recovery_threshold)
            .bind(repeat_interval_secs)
            .bind(now.naive_utc().to_string())
            .bind(now.naive_utc().to_string())
            .execute(&mut *tx)
            .await?;

            sqlx::query_as::<_, Monitor>(
                r#"
                SELECT id, name, check_type, url, interval_secs, timeout_secs,
                       expected_status, fail_threshold, recovery_threshold,
                       repeat_interval_secs, enabled, created_at, updated_at
                FROM monitors
                WHERE id = $1
                "#,
            )
            .bind(monitor_id.to_string())
            .fetch_one(&mut *tx)
            .await?
        };

        // Insert initial state row
        #[cfg(feature = "postgres")]
        sqlx::query(
            r#"
            INSERT INTO monitor_states (monitor_id, state, fail_counter, recovery_counter,
                                        next_check_at, alert_count)
            VALUES ($1, 'up', 0, 0, $2, 0)
            "#,
        )
        .bind(monitor_id)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        #[cfg(feature = "sqlite")]
        sqlx::query(
            r#"
            INSERT INTO monitor_states (monitor_id, state, fail_counter, recovery_counter,
                                        next_check_at, alert_count)
            VALUES ($1, 'up', 0, 0, $2, 0)
            "#,
        )
        .bind(monitor_id.to_string())
        .bind(now.naive_utc().to_string())
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(monitor)
    }

    /// Updates a monitor
    pub async fn update(pool: &DbPool, id: Uuid, dto: UpdateMonitor) -> AppResult<Monitor> {
        let existing = Self::get(pool, id).await?;

        // Merge with existing values for validation
        let interval_secs = dto.interval_secs.unwrap_or(existing.interval_secs);
        let timeout_secs = dto.timeout_secs.unwrap_or(existing.timeout_secs);
        let fail_threshold = dto.fail_threshold.unwrap_or(existing.fail_threshold);
        let recovery_threshold = dto
            .recovery_threshold
            .unwrap_or(existing.recovery_threshold);

        validate_monitor_bounds(
            interval_secs,
            timeout_secs,
            fail_threshold,
            recovery_threshold,
        )?;
        let repeat_interval_secs = dto
            .repeat_interval_secs
            .unwrap_or(existing.repeat_interval_secs);
        validate_repeat_interval(repeat_interval_secs)?;

        // If URL is being changed, validate the new URL
        let url = dto.url.as_deref().unwrap_or(&existing.url);
        if dto.url.is_some() {
            let check_type =
                CheckType::try_from(existing.check_type.as_str()).map_err(AppError::Validation)?;
            validate_monitor_url(url, &check_type).await?;
        }

        let now = Utc::now();

        #[cfg(feature = "postgres")]
        let monitor = sqlx::query_as::<_, Monitor>(
            r#"
            UPDATE monitors
            SET name = COALESCE($2, name),
                url = COALESCE($3, url),
                interval_secs = $4,
                timeout_secs = $5,
                expected_status = COALESCE($6, expected_status),
                fail_threshold = $7,
                recovery_threshold = $8,
                repeat_interval_secs = COALESCE($9, repeat_interval_secs),
                enabled = COALESCE($10, enabled),
                updated_at = $11
            WHERE id = $1
            RETURNING id, name, check_type, url, interval_secs, timeout_secs,
                      expected_status, fail_threshold, recovery_threshold,
                      repeat_interval_secs, enabled, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&dto.name)
        .bind(&dto.url)
        .bind(interval_secs)
        .bind(timeout_secs)
        .bind(dto.expected_status)
        .bind(fail_threshold)
        .bind(recovery_threshold)
        .bind(dto.repeat_interval_secs)
        .bind(dto.enabled)
        .bind(now)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Monitor {id} not found")))?;

        #[cfg(feature = "sqlite")]
        let monitor = {
            sqlx::query(
                r#"
                UPDATE monitors
                SET name = COALESCE($2, name),
                    url = COALESCE($3, url),
                    interval_secs = $4,
                    timeout_secs = $5,
                    expected_status = COALESCE($6, expected_status),
                    fail_threshold = $7,
                    recovery_threshold = $8,
                    repeat_interval_secs = COALESCE($9, repeat_interval_secs),
                    enabled = COALESCE($10, enabled),
                    updated_at = $11
                WHERE id = $12
                "#,
            )
            .bind(&dto.name)
            .bind(&dto.url)
            .bind(interval_secs)
            .bind(timeout_secs)
            .bind(dto.expected_status)
            .bind(fail_threshold)
            .bind(recovery_threshold)
            .bind(dto.repeat_interval_secs)
            .bind(dto.enabled.map(|b| if b { 1i64 } else { 0i64 }))
            .bind(now.naive_utc().to_string())
            .bind(id.to_string())
            .execute(pool)
            .await?;

            Self::get(pool, id).await?
        };

        Ok(monitor)
    }

    /// Deletes a monitor
    pub async fn delete(pool: &DbPool, id: Uuid) -> AppResult<()> {
        let result = sqlx::query("DELETE FROM monitors WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound(format!("Monitor {id} not found")));
        }

        Ok(())
    }

    /// Assigns channels to a monitor, replacing all previous assignments
    pub async fn assign_channels(
        pool: &DbPool,
        monitor_id: Uuid,
        channel_ids: Vec<i32>,
    ) -> AppResult<()> {
        let mut tx = pool.begin().await?;

        // Verify monitor exists before modifying its channels
        #[cfg(feature = "postgres")]
        let exists: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM monitors WHERE id = $1)")
                .bind(monitor_id)
                .fetch_one(&mut *tx)
                .await?;

        #[cfg(feature = "sqlite")]
        let exists: bool = {
            let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM monitors WHERE id = $1")
                .bind(monitor_id.to_string())
                .fetch_one(&mut *tx)
                .await?;
            count > 0
        };

        if !exists {
            return Err(AppError::NotFound(format!(
                "Monitor {monitor_id} not found"
            )));
        }

        // Remove existing
        sqlx::query("DELETE FROM monitor_alert_channels WHERE monitor_id = $1")
            .bind(monitor_id)
            .execute(&mut *tx)
            .await?;

        // Insert new
        for channel_id in channel_ids {
            sqlx::query(
                "INSERT INTO monitor_alert_channels (monitor_id, channel_id) VALUES ($1, $2)",
            )
            .bind(monitor_id)
            .bind(channel_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                if let sqlx::Error::Database(ref db_err) = e {
                    if db_err.is_foreign_key_violation() {
                        return AppError::NotFound(format!("Channel {channel_id} not found"));
                    }
                }
                AppError::Database(e)
            })?;
        }

        tx.commit().await?;

        Ok(())
    }

    /// Gets the current state of a monitor
    pub async fn get_state(pool: &DbPool, monitor_id: Uuid) -> AppResult<Option<MonitorState>> {
        let state = sqlx::query_as::<_, MonitorState>(
            r#"
            SELECT monitor_id, state, fail_counter, recovery_counter,
                   last_check_at, next_check_at, alerted_down_at, last_alerted_at,
                   alert_count, incident_id
            FROM monitor_states
            WHERE monitor_id = $1
            "#,
        )
        .bind(monitor_id)
        .fetch_optional(pool)
        .await?;

        Ok(state)
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // -------------------------------------------------------------------------
    // validate_monitor_bounds tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_valid_bounds() {
        assert!(validate_monitor_bounds(60, 10, 2, 2).is_ok());
        assert!(validate_monitor_bounds(30, 1, 1, 1).is_ok());
        assert!(validate_monitor_bounds(86400, 60, 5, 5).is_ok());
    }

    #[test]
    fn test_interval_too_low() {
        let err = validate_monitor_bounds(29, 10, 2, 2).unwrap_err();
        assert!(err.to_string().contains("interval_secs"));
    }

    #[test]
    fn test_interval_too_high() {
        let err = validate_monitor_bounds(86401, 10, 2, 2).unwrap_err();
        assert!(err.to_string().contains("interval_secs"));
    }

    #[test]
    fn test_timeout_too_low() {
        let err = validate_monitor_bounds(60, 0, 2, 2).unwrap_err();
        assert!(err.to_string().contains("timeout_secs"));
    }

    #[test]
    fn test_timeout_too_high() {
        let err = validate_monitor_bounds(60, 61, 2, 2).unwrap_err();
        assert!(err.to_string().contains("timeout_secs"));
    }

    #[test]
    fn test_fail_threshold_out_of_range() {
        assert!(validate_monitor_bounds(60, 10, 0, 2).is_err());
        assert!(validate_monitor_bounds(60, 10, 6, 2).is_err());
    }

    #[test]
    fn test_recovery_threshold_out_of_range() {
        assert!(validate_monitor_bounds(60, 10, 2, 0).is_err());
        assert!(validate_monitor_bounds(60, 10, 2, 6).is_err());
    }

    // -------------------------------------------------------------------------
    // validate_monitor_url tests
    // -------------------------------------------------------------------------

    #[tokio::test]
    async fn test_valid_http_url() {
        // Public domain — allowed
        let result = validate_monitor_url("https://example.com", &CheckType::Http).await;
        assert!(result.is_ok(), "expected Ok, got {:?}", result);
    }

    #[tokio::test]
    async fn test_rfc1918_10_blocked() {
        let result = validate_monitor_url("http://10.0.0.1/health", &CheckType::Http).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("reserved"));
    }

    #[tokio::test]
    async fn test_rfc1918_172_blocked() {
        let result = validate_monitor_url("http://172.16.0.1/health", &CheckType::Http).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("reserved"));
    }

    #[tokio::test]
    async fn test_rfc1918_192168_blocked() {
        let result = validate_monitor_url("http://192.168.1.1/health", &CheckType::Http).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("reserved"));
    }

    #[tokio::test]
    async fn test_loopback_127_blocked() {
        let result = validate_monitor_url("http://127.0.0.1/health", &CheckType::Http).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("reserved"));
    }

    #[tokio::test]
    async fn test_metadata_ip_169254_blocked() {
        let result =
            validate_monitor_url("http://169.254.169.254/latest/meta-data/", &CheckType::Http)
                .await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("reserved"));
    }

    #[tokio::test]
    async fn test_tcp_valid() {
        let result = validate_monitor_url("example.com:5432", &CheckType::Tcp).await;
        assert!(result.is_ok(), "expected Ok, got {:?}", result);
    }

    #[tokio::test]
    async fn test_tcp_valid_ip_port() {
        let result = validate_monitor_url("1.2.3.4:80", &CheckType::Tcp).await;
        assert!(result.is_ok(), "expected Ok, got {:?}", result);
    }

    #[tokio::test]
    async fn test_tcp_no_port() {
        let result = validate_monitor_url("example.com", &CheckType::Tcp).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("host:port"));
    }

    #[tokio::test]
    async fn test_tcp_port_zero() {
        let result = validate_monitor_url("example.com:0", &CheckType::Tcp).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("port"));
    }

    #[tokio::test]
    async fn test_tcp_port_too_high() {
        let result = validate_monitor_url("example.com:65536", &CheckType::Tcp).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("port"));
    }

    #[tokio::test]
    async fn test_http_invalid_scheme() {
        let result = validate_monitor_url("ftp://example.com", &CheckType::Http).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("http or https"));
    }

    #[tokio::test]
    async fn test_http_invalid_url() {
        let result = validate_monitor_url("not a url", &CheckType::Http).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Invalid URL"));
    }

    #[tokio::test]
    async fn test_cgnat_blocked() {
        let result = validate_monitor_url("http://100.64.0.1/health", &CheckType::Http).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("reserved"));
    }

    #[tokio::test]
    async fn test_ipv6_loopback_blocked() {
        let result = validate_monitor_url("http://[::1]/health", &CheckType::Http).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("reserved"));
    }

    #[tokio::test]
    async fn test_ipv6_ula_blocked() {
        let result = validate_monitor_url("http://[fd12:3456::1]/health", &CheckType::Http).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("reserved"));
    }

    #[tokio::test]
    async fn test_ipv4_mapped_ipv6_blocked() {
        let result =
            validate_monitor_url("http://[::ffff:127.0.0.1]/health", &CheckType::Http).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("reserved"));
    }

    #[tokio::test]
    async fn test_tcp_private_ip_blocked() {
        let result = validate_monitor_url("10.0.0.1:5432", &CheckType::Tcp).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("reserved"));
    }

    #[tokio::test]
    async fn test_tcp_loopback_blocked() {
        let result = validate_monitor_url("127.0.0.1:22", &CheckType::Tcp).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("reserved"));
    }

    #[test]
    fn test_repeat_interval_zero_rejected() {
        assert!(validate_repeat_interval(0).is_err());
        assert!(validate_repeat_interval(-1).is_err());
    }

    #[test]
    fn test_repeat_interval_valid() {
        assert!(validate_repeat_interval(1).is_ok());
        assert!(validate_repeat_interval(3600).is_ok());
    }
}
