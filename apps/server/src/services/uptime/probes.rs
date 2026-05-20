//! Uptime probe implementations for HTTP and TCP checks.

use std::net::IpAddr;
use std::time::{Duration, Instant};

use url::Url;

use crate::models::monitor::Monitor;
use crate::services::monitor::is_ip_reserved;

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

// =============================================================================
// Probe-time SSRF guard
// =============================================================================

/// Resolves the host portion of `url_str` and checks every resulting IP against
/// the reserved-range list. Returns `Err` if any address is reserved.
///
/// This runs at probe time (not only at creation time) to mitigate DNS rebinding:
/// an attacker who controls DNS could register a public IP at creation, pass
/// validation, then flip to 169.254.169.254 before the first scheduled probe.
#[cfg(not(test))]
async fn check_ssrf_http(url_str: &str) -> Result<(), String> {
    let parsed = Url::parse(url_str).map_err(|e| format!("invalid URL: {e}"))?;
    let host = parsed
        .host_str()
        .ok_or_else(|| "URL has no host".to_string())?
        .to_string();

    if let Ok(ip) = host.parse::<IpAddr>() {
        if is_ip_reserved(ip) {
            return Err(format!("probe target is a reserved/private address: {ip}"));
        }
        return Ok(());
    }

    let port = parsed.port_or_known_default().unwrap_or(80);
    let addr_str = format!("{host}:{port}");
    let resolved = tokio::task::spawn_blocking(move || {
        use std::net::ToSocketAddrs;
        addr_str
            .to_socket_addrs()
            .map(|iter| iter.collect::<Vec<_>>())
    })
    .await
    .map_err(|e| format!("internal error: {e}"))?;

    if let Ok(addrs) = resolved {
        for addr in addrs {
            if is_ip_reserved(addr.ip()) {
                return Err(format!(
                    "probe target resolves to a reserved/private address: {}",
                    addr.ip()
                ));
            }
        }
    }

    Ok(())
}

/// Resolves `host:port`, checks every resulting IP, and returns the socket addresses
/// to connect to. For TCP probes we connect directly by IP, fully closing the TOCTOU window.
#[cfg(not(test))]
async fn resolve_and_check_tcp(host: &str, port: u16) -> Result<Vec<std::net::SocketAddr>, String> {
    if let Ok(ip) = host.parse::<IpAddr>() {
        if is_ip_reserved(ip) {
            return Err(format!("probe target is a reserved/private address: {ip}"));
        }
        return Ok(vec![std::net::SocketAddr::new(ip, port)]);
    }

    let addr_str = format!("{host}:{port}");
    let resolved = tokio::task::spawn_blocking(move || {
        use std::net::ToSocketAddrs;
        addr_str
            .to_socket_addrs()
            .map(|iter| iter.collect::<Vec<_>>())
    })
    .await
    .map_err(|e| format!("internal error: {e}"))?;

    match resolved {
        Err(e) => Err(format!("DNS resolution failed: {e}")),
        Ok(addrs) => {
            for addr in &addrs {
                if is_ip_reserved(addr.ip()) {
                    return Err(format!(
                        "probe target resolves to a reserved/private address: {}",
                        addr.ip()
                    ));
                }
            }
            if addrs.is_empty() {
                return Err("DNS returned no addresses".to_string());
            }
            Ok(addrs)
        }
    }
}

// =============================================================================
// Probes
// =============================================================================

/// Runs an HTTP probe against the monitor's URL.
///
/// Success is defined as:
/// - If `expected_status` is set: response status must match exactly.
/// - Otherwise: any 2xx response is success.
pub async fn run_http_probe(client: &reqwest::Client, monitor: &Monitor) -> ProbeResult {
    let timeout = Duration::from_secs(monitor.timeout_secs as u64);
    let start = Instant::now();

    // Probe-time SSRF guard (mitigates DNS rebinding after creation-time validation).
    // Skipped in #[cfg(test)] so unit tests can use mockito (localhost).
    #[cfg(not(test))]
    if let Err(reason) = check_ssrf_http(&monitor.url).await {
        return ProbeResult {
            ok: false,
            latency_ms: 0,
            error: Some(reason),
        };
    }

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
///
/// Resolves the hostname and connects by IP to close the DNS TOCTOU window entirely.
pub async fn run_tcp_probe(monitor: &Monitor) -> ProbeResult {
    let timeout = Duration::from_secs(monitor.timeout_secs as u64);
    let start = Instant::now();

    // Split host:port (rfind handles IPv6 bracket notation where applicable)
    let colon = monitor.url.rfind(':').unwrap_or(0);
    let host = &monitor.url[..colon];
    let port: u16 = monitor.url[colon + 1..].parse().unwrap_or(0);

    // Resolve hostname and check SSRF; connect directly to IP to close TOCTOU window.
    // Skipped in #[cfg(test)] so unit tests can use loopback addresses.
    #[cfg(not(test))]
    let addrs = match resolve_and_check_tcp(host, port).await {
        Ok(a) => a,
        Err(reason) => {
            return ProbeResult {
                ok: false,
                latency_ms: start.elapsed().as_millis() as u64,
                error: Some(reason),
            }
        }
    };
    #[cfg(not(test))]
    let first_addr = addrs.into_iter().next().unwrap();

    // In tests: connect by original address string (no SSRF check, allows localhost)
    #[cfg(test)]
    let first_addr: std::net::SocketAddr = format!("{host}:{port}").parse().unwrap();

    let connect_future = tokio::net::TcpStream::connect(first_addr);
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
