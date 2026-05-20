//! Uptime probe implementations for HTTP and TCP checks.

use std::time::{Duration, Instant};

use crate::models::monitor::Monitor;

/// Result of a single probe execution
#[derive(Debug)]
pub struct ProbeResult {
    /// Whether the probe succeeded
    pub ok: bool,
    /// Round-trip latency in milliseconds
    pub latency_ms: u64,
    /// Error message if the probe failed
    pub error: Option<String>,
}

/// Runs an HTTP probe against the monitor's URL.
///
/// Success is defined as:
/// - If `expected_status` is set: response status must match exactly.
/// - Otherwise: any 2xx response is success.
pub async fn run_http_probe(client: &reqwest::Client, monitor: &Monitor) -> ProbeResult {
    let timeout = Duration::from_secs(monitor.timeout_secs as u64);
    let start = Instant::now();

    let result = client.get(&monitor.url).timeout(timeout).send().await;

    let latency_ms = start.elapsed().as_millis() as u64;

    match result {
        Ok(response) => {
            let status = response.status();
            let status_u16 = status.as_u16();
            let ok = if let Some(expected) = monitor.expected_status {
                status_u16 == expected as u16
            } else {
                status.is_success()
            };

            if ok {
                ProbeResult {
                    ok: true,
                    latency_ms,
                    error: None,
                }
            } else {
                ProbeResult {
                    ok: false,
                    latency_ms,
                    error: Some(format!("unexpected status code: {status_u16}")),
                }
            }
        }
        Err(e) => {
            let error_msg = if e.is_timeout() {
                format!("probe timed out after {}s", monitor.timeout_secs)
            } else if e.is_connect() {
                "connection failed".to_string()
            } else {
                format!("request failed: {e}")
            };

            ProbeResult {
                ok: false,
                latency_ms,
                error: Some(error_msg),
            }
        }
    }
}

/// Runs a TCP probe against the monitor's URL (expected format: `host:port`).
pub async fn run_tcp_probe(monitor: &Monitor) -> ProbeResult {
    let timeout = Duration::from_secs(monitor.timeout_secs as u64);
    let start = Instant::now();

    let connect_future = tokio::net::TcpStream::connect(&monitor.url);
    let result = tokio::time::timeout(timeout, connect_future).await;

    let latency_ms = start.elapsed().as_millis() as u64;

    match result {
        Ok(Ok(_stream)) => ProbeResult {
            ok: true,
            latency_ms,
            error: None,
        },
        Ok(Err(e)) => {
            let error_msg = if e.kind() == std::io::ErrorKind::ConnectionRefused {
                "connection refused".to_string()
            } else {
                format!("connection failed: {e}")
            };
            ProbeResult {
                ok: false,
                latency_ms,
                error: Some(error_msg),
            }
        }
        Err(_) => ProbeResult {
            ok: false,
            latency_ms,
            error: Some(format!("probe timed out after {}s", monitor.timeout_secs)),
        },
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;

    fn make_http_monitor(url: &str, expected_status: Option<i32>) -> Monitor {
        Monitor {
            id: Uuid::new_v4(),
            name: "test".to_string(),
            check_type: "http".to_string(),
            url: url.to_string(),
            interval_secs: 60,
            timeout_secs: 5,
            expected_status,
            fail_threshold: 2,
            recovery_threshold: 2,
            repeat_interval_secs: 3600,
            enabled: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    fn make_tcp_monitor(addr: &str) -> Monitor {
        Monitor {
            id: Uuid::new_v4(),
            name: "test-tcp".to_string(),
            check_type: "tcp".to_string(),
            url: addr.to_string(),
            interval_secs: 60,
            timeout_secs: 5,
            expected_status: None,
            fail_threshold: 2,
            recovery_threshold: 2,
            repeat_interval_secs: 3600,
            enabled: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[tokio::test]
    async fn test_http_probe_200_ok() {
        let mut server = mockito::Server::new_async().await;
        let _mock = server
            .mock("GET", "/health")
            .with_status(200)
            .create_async()
            .await;

        let url = format!("{}/health", server.url());
        let monitor = make_http_monitor(&url, None);
        let client = reqwest::Client::new();

        let result = run_http_probe(&client, &monitor).await;
        assert!(
            result.ok,
            "expected ok=true for 200, got error: {:?}",
            result.error
        );
        assert!(result.latency_ms < 5000);
        assert!(result.error.is_none());
    }

    #[tokio::test]
    async fn test_http_probe_500_not_ok() {
        let mut server = mockito::Server::new_async().await;
        let _mock = server
            .mock("GET", "/")
            .with_status(500)
            .create_async()
            .await;

        let monitor = make_http_monitor(&server.url(), None);
        let client = reqwest::Client::new();

        let result = run_http_probe(&client, &monitor).await;
        assert!(!result.ok);
        assert!(result.error.is_some());
        assert!(
            result.error.unwrap().contains("500"),
            "error should mention status code"
        );
    }

    #[tokio::test]
    async fn test_http_probe_expected_status_matches() {
        let mut server = mockito::Server::new_async().await;
        let _mock = server
            .mock("GET", "/")
            .with_status(201)
            .create_async()
            .await;

        let monitor = make_http_monitor(&server.url(), Some(201));
        let client = reqwest::Client::new();

        let result = run_http_probe(&client, &monitor).await;
        assert!(result.ok);
    }

    #[tokio::test]
    async fn test_http_probe_expected_status_mismatch() {
        let mut server = mockito::Server::new_async().await;
        let _mock = server
            .mock("GET", "/")
            .with_status(200)
            .create_async()
            .await;

        let monitor = make_http_monitor(&server.url(), Some(201));
        let client = reqwest::Client::new();

        let result = run_http_probe(&client, &monitor).await;
        assert!(!result.ok);
    }

    #[tokio::test]
    async fn test_tcp_probe_refused_port() {
        // Port 1 is almost certainly not listening
        let monitor = make_tcp_monitor("127.0.0.1:1");
        let result = run_tcp_probe(&monitor).await;
        assert!(!result.ok);
        let err = result.error.unwrap();
        assert!(
            err.contains("refused") || err.contains("connection failed"),
            "expected connection error, got: {err}"
        );
    }
}
