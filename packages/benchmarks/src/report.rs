//! Benchmark report generation.

use crate::config::ScenarioConfig;
use crate::metrics::ContainerMetrics;
use crate::runner::StatsSnapshot;
use chrono::{DateTime, Utc};
use colored::Colorize;
use hdrhistogram::Histogram;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::Duration;

/// Throughput metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThroughputMetrics {
    /// Total requests sent
    pub total_requests: u64,
    /// Successful requests (2xx)
    pub successful: u64,
    /// Failed requests
    pub failed: u64,
    /// Achieved events per second
    pub events_per_second: f64,
}

/// Latency metrics in milliseconds
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatencyMetrics {
    /// 50th percentile (median)
    pub p50: f64,
    /// 95th percentile
    pub p95: f64,
    /// 99th percentile
    pub p99: f64,
    /// Maximum latency
    pub max: f64,
    /// Minimum latency
    pub min: f64,
    /// Mean latency
    pub mean: f64,
}

/// Memory metrics in megabytes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryMetricsReport {
    /// Memory at idle (before test)
    pub idle_mb: f64,
    /// Peak memory usage
    pub peak_mb: f64,
    /// Average memory usage
    pub average_mb: f64,
    /// Memory limit if set
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit_mb: Option<f64>,
}

/// CPU metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuMetricsReport {
    /// Peak CPU usage percentage
    pub peak_percent: f64,
    /// Average CPU usage percentage
    pub average_percent: f64,
}

/// Error breakdown
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorMetrics {
    /// Rate limited requests (429)
    pub rate_limited_429: u64,
    /// Server errors (5xx)
    pub server_error_5xx: u64,
    /// Connection failures
    pub connection_failed: u64,
}

/// Scenario configuration summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigSummary {
    /// Test duration in seconds
    pub duration_secs: u64,
    /// Target requests per second
    pub target_rps: u64,
    /// Number of concurrent connections
    pub concurrency: u32,
    /// Warmup duration in seconds
    pub warmup_secs: u64,
}

/// Complete benchmark results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResults {
    /// Unique run identifier
    pub run_id: String,
    /// Timestamp of the run
    pub timestamp: DateTime<Utc>,
    /// Scenario name
    pub scenario: String,
    /// Server version (if available)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_version: Option<String>,
    /// Configuration summary
    pub config: ConfigSummary,
    /// Results section
    pub results: ResultsSection,
}

/// Results section containing all metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResultsSection {
    /// Throughput metrics
    pub throughput: ThroughputMetrics,
    /// Latency metrics
    pub latency_ms: LatencyMetrics,
    /// Memory metrics
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory_mb: Option<MemoryMetricsReport>,
    /// CPU metrics
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cpu_percent: Option<CpuMetricsReport>,
    /// Error breakdown
    pub errors: ErrorMetrics,
    /// Actual test duration
    pub actual_duration_secs: f64,
}

impl BenchmarkResults {
    /// Create new benchmark results from raw data
    pub fn new(
        config: &ScenarioConfig,
        stats: StatsSnapshot,
        histogram: &Histogram<u64>,
        duration: Duration,
        container_metrics: Option<ContainerMetrics>,
    ) -> Self {
        let run_id = format!(
            "{}-{}-{:03}",
            Utc::now().format("%Y%m%d"),
            config.name,
            rand::rng().random_range(0..1000u16)
        );

        let duration_secs = duration.as_secs_f64();
        let events_per_second = if duration_secs > 0.0 {
            stats.successful as f64 / duration_secs
        } else {
            0.0
        };

        // Convert histogram values from microseconds to milliseconds
        let latency = if histogram.len() > 0 {
            LatencyMetrics {
                p50: histogram.value_at_percentile(50.0) as f64 / 1000.0,
                p95: histogram.value_at_percentile(95.0) as f64 / 1000.0,
                p99: histogram.value_at_percentile(99.0) as f64 / 1000.0,
                max: histogram.max() as f64 / 1000.0,
                min: histogram.min() as f64 / 1000.0,
                mean: histogram.mean() / 1000.0,
            }
        } else {
            LatencyMetrics {
                p50: 0.0,
                p95: 0.0,
                p99: 0.0,
                max: 0.0,
                min: 0.0,
                mean: 0.0,
            }
        };

        let (memory_mb, cpu_percent) = if let Some(ref metrics) = container_metrics {
            (
                Some(MemoryMetricsReport {
                    idle_mb: metrics.memory.idle_mb,
                    peak_mb: metrics.memory.peak_mb,
                    average_mb: metrics.memory.average_mb,
                    limit_mb: metrics.memory.limit_mb,
                }),
                Some(CpuMetricsReport {
                    peak_percent: metrics.cpu.peak_percent,
                    average_percent: metrics.cpu.average_percent,
                }),
            )
        } else {
            (None, None)
        };

        Self {
            run_id,
            timestamp: Utc::now(),
            scenario: config.name.clone(),
            server_version: None,
            config: ConfigSummary {
                duration_secs: config.duration_secs,
                target_rps: config.target_rps,
                concurrency: config.concurrency,
                warmup_secs: config.warmup_secs,
            },
            results: ResultsSection {
                throughput: ThroughputMetrics {
                    total_requests: stats.total_requests,
                    successful: stats.successful,
                    failed: stats.failed,
                    events_per_second,
                },
                latency_ms: latency,
                memory_mb,
                cpu_percent,
                errors: ErrorMetrics {
                    rate_limited_429: stats.rate_limited,
                    server_error_5xx: stats.server_errors,
                    connection_failed: stats.failed - stats.rate_limited - stats.server_errors,
                },
                actual_duration_secs: duration_secs,
            },
        }
    }

    /// Add container metrics to results
    pub fn with_container_metrics(mut self, metrics: ContainerMetrics) -> Self {
        self.results.memory_mb = Some(MemoryMetricsReport {
            idle_mb: metrics.memory.idle_mb,
            peak_mb: metrics.memory.peak_mb,
            average_mb: metrics.memory.average_mb,
            limit_mb: metrics.memory.limit_mb,
        });
        self.results.cpu_percent = Some(CpuMetricsReport {
            peak_percent: metrics.cpu.peak_percent,
            average_percent: metrics.cpu.average_percent,
        });
        self
    }

    /// Set server version
    pub fn with_server_version(mut self, version: &str) -> Self {
        self.server_version = Some(version.to_string());
        self
    }

    /// Save results to a JSON file
    pub fn save(&self, output_dir: impl AsRef<Path>) -> std::io::Result<String> {
        let output_dir = output_dir.as_ref();
        fs::create_dir_all(output_dir)?;

        let filename = format!("{}.json", self.run_id);
        let filepath = output_dir.join(&filename);

        let json = serde_json::to_string_pretty(self)?;
        fs::write(&filepath, &json)?;

        // Also save as latest.json for convenience
        let latest_path = output_dir.join("latest.json");
        fs::write(&latest_path, &json)?;

        Ok(filepath.to_string_lossy().to_string())
    }

    /// Print a summary to the console
    pub fn print_summary(&self) {
        println!("\n{}", "═".repeat(60).cyan());
        println!(
            "{} {}",
            "Benchmark Results:".bold(),
            self.scenario.cyan().bold()
        );
        println!("{}", "═".repeat(60).cyan());

        println!("\n{}", "Throughput".yellow().bold());
        println!(
            "  Total requests:    {}",
            self.results.throughput.total_requests.to_string().white()
        );
        println!(
            "  Successful:        {}",
            self.results.throughput.successful.to_string().green()
        );
        println!(
            "  Failed:            {}",
            if self.results.throughput.failed > 0 {
                self.results.throughput.failed.to_string().red()
            } else {
                self.results.throughput.failed.to_string().green()
            }
        );
        println!(
            "  Events/sec:        {}",
            format!("{:.2}", self.results.throughput.events_per_second)
                .cyan()
                .bold()
        );

        println!("\n{}", "Latency".yellow().bold());
        println!(
            "  P50:               {}",
            format!("{:.2}ms", self.results.latency_ms.p50).white()
        );
        println!(
            "  P95:               {}",
            format!("{:.2}ms", self.results.latency_ms.p95).white()
        );
        println!(
            "  P99:               {}",
            format!("{:.2}ms", self.results.latency_ms.p99)
                .yellow()
                .bold()
        );
        println!(
            "  Max:               {}",
            format!("{:.2}ms", self.results.latency_ms.max).white()
        );
        println!(
            "  Mean:              {}",
            format!("{:.2}ms", self.results.latency_ms.mean).white()
        );

        if let Some(ref memory) = self.results.memory_mb {
            println!("\n{}", "Memory".yellow().bold());
            println!(
                "  Idle:              {}",
                format!("{:.1} MB", memory.idle_mb).white()
            );
            println!(
                "  Peak:              {}",
                format!("{:.1} MB", memory.peak_mb).cyan().bold()
            );
            println!(
                "  Average:           {}",
                format!("{:.1} MB", memory.average_mb).white()
            );
            if let Some(limit) = memory.limit_mb {
                println!(
                    "  Limit:             {}",
                    format!("{:.1} MB", limit).dimmed()
                );
            }
        }

        if let Some(ref cpu) = self.results.cpu_percent {
            println!("\n{}", "CPU".yellow().bold());
            println!(
                "  Peak:              {}",
                format!("{:.1}%", cpu.peak_percent).cyan().bold()
            );
            println!(
                "  Average:           {}",
                format!("{:.1}%", cpu.average_percent).white()
            );
        }

        if self.results.errors.rate_limited_429 > 0
            || self.results.errors.server_error_5xx > 0
            || self.results.errors.connection_failed > 0
        {
            println!("\n{}", "Errors".red().bold());
            if self.results.errors.rate_limited_429 > 0 {
                println!(
                    "  Rate limited (429): {}",
                    self.results.errors.rate_limited_429.to_string().yellow()
                );
            }
            if self.results.errors.server_error_5xx > 0 {
                println!(
                    "  Server errors (5xx): {}",
                    self.results.errors.server_error_5xx.to_string().red()
                );
            }
            if self.results.errors.connection_failed > 0 {
                println!(
                    "  Connection failed:  {}",
                    self.results.errors.connection_failed.to_string().red()
                );
            }
        }

        println!("\n{}", "═".repeat(60).cyan());
        println!("{} {}", "Run ID:".dimmed(), self.run_id.dimmed());
        println!(
            "{} {}s",
            "Duration:".dimmed(),
            format!("{:.1}", self.results.actual_duration_secs).dimmed()
        );
        println!("{}", "═".repeat(60).cyan());
    }
}

/// Compare two benchmark results
pub fn compare(old: &BenchmarkResults, new: &BenchmarkResults) {
    println!("\n{}", "═".repeat(60).cyan());
    println!(
        "{} {} {} {}",
        "Comparison:".bold(),
        old.run_id.dimmed(),
        "→".dimmed(),
        new.run_id.cyan()
    );
    println!("{}", "═".repeat(60).cyan());

    let throughput_change = (new.results.throughput.events_per_second
        - old.results.throughput.events_per_second)
        / old.results.throughput.events_per_second
        * 100.0;

    let latency_change = (new.results.latency_ms.p99 - old.results.latency_ms.p99)
        / old.results.latency_ms.p99
        * 100.0;

    println!("\n{}", "Throughput".yellow().bold());
    println!(
        "  Events/sec:  {:.2} → {:.2} ({})",
        old.results.throughput.events_per_second,
        new.results.throughput.events_per_second,
        format_change(throughput_change, true)
    );

    println!("\n{}", "Latency P99".yellow().bold());
    println!(
        "  {:.2}ms → {:.2}ms ({})",
        old.results.latency_ms.p99,
        new.results.latency_ms.p99,
        format_change(latency_change, false)
    );

    if let (Some(old_mem), Some(new_mem)) = (&old.results.memory_mb, &new.results.memory_mb) {
        let memory_change = (new_mem.peak_mb - old_mem.peak_mb) / old_mem.peak_mb * 100.0;

        println!("\n{}", "Peak Memory".yellow().bold());
        println!(
            "  {:.1}MB → {:.1}MB ({})",
            old_mem.peak_mb,
            new_mem.peak_mb,
            format_change(memory_change, false)
        );
    }

    println!("{}", "═".repeat(60).cyan());
}

fn format_change(percent: f64, higher_is_better: bool) -> colored::ColoredString {
    let is_improvement = if higher_is_better {
        percent > 0.0
    } else {
        percent < 0.0
    };

    let sign = if percent > 0.0 { "+" } else { "" };
    let text = format!("{}{:.1}%", sign, percent);

    if is_improvement {
        text.green()
    } else if percent.abs() < 1.0 {
        text.white()
    } else {
        text.red()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use hdrhistogram::Histogram;

    #[test]
    fn test_results_creation() {
        let config = ScenarioConfig::sustained();
        let stats = StatsSnapshot {
            total_requests: 1000,
            successful: 950,
            failed: 50,
            rate_limited: 30,
            server_errors: 20,
        };

        let mut histogram = Histogram::<u64>::new_with_bounds(1, 60_000_000, 3).unwrap();
        for i in 0..100 {
            histogram.record(i * 1000).unwrap(); // 0-99ms in microseconds
        }

        let results =
            BenchmarkResults::new(&config, stats, &histogram, Duration::from_secs(10), None);

        assert_eq!(results.scenario, "sustained");
        assert_eq!(results.results.throughput.total_requests, 1000);
        assert_eq!(results.results.throughput.successful, 950);
        assert!((results.results.throughput.events_per_second - 95.0).abs() < 0.1);
    }

    #[test]
    fn test_json_serialization() {
        let config = ScenarioConfig::baseline();
        let stats = StatsSnapshot::default();
        let histogram = Histogram::<u64>::new_with_bounds(1, 60_000_000, 3).unwrap();

        let results =
            BenchmarkResults::new(&config, stats, &histogram, Duration::from_secs(60), None);

        let json = serde_json::to_string(&results).unwrap();
        assert!(json.contains("baseline"));
        assert!(json.contains("throughput"));
        assert!(json.contains("latency_ms"));
    }
}
