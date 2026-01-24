//! Benchmark runner for executing load tests.

use crate::config::{ScenarioConfig, ScenarioType};
use crate::envelope::{EnvelopeGenerator, EventConfig};
use crate::metrics::MetricsCollector;
use crate::report::BenchmarkResults;
use colored::Colorize;
use futures::stream::{self, StreamExt};
use hdrhistogram::Histogram;
use indicatif::{ProgressBar, ProgressStyle};
use reqwest::Client;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use thiserror::Error;
use tokio::sync::Mutex;
use tokio::time::interval;

/// Runner errors
#[derive(Debug, Error)]
pub enum RunnerError {
    #[error("HTTP error: {0}")]
    HttpError(#[from] reqwest::Error),
    #[error("Metrics error: {0}")]
    MetricsError(#[from] crate::metrics::MetricsError),
    #[error("Server not ready after {0} seconds")]
    ServerNotReady(u64),
    #[error("Invalid server URL: {0}")]
    InvalidUrl(String),
}

/// Request result
#[derive(Debug, Clone, Copy)]
pub struct RequestResult {
    /// Latency in microseconds
    pub latency_us: u64,
    /// HTTP status code
    pub status: u16,
    /// Whether the request was successful (2xx)
    pub success: bool,
}

/// Live statistics during benchmark
#[derive(Debug, Default)]
pub struct LiveStats {
    pub total_requests: AtomicU64,
    pub successful: AtomicU64,
    pub failed: AtomicU64,
    pub rate_limited: AtomicU64,
    pub server_errors: AtomicU64,
}

impl LiveStats {
    pub fn record(&self, result: &RequestResult) {
        self.total_requests.fetch_add(1, Ordering::Relaxed);

        if result.success {
            self.successful.fetch_add(1, Ordering::Relaxed);
        } else {
            self.failed.fetch_add(1, Ordering::Relaxed);

            if result.status == 429 {
                self.rate_limited.fetch_add(1, Ordering::Relaxed);
            } else if result.status >= 500 {
                self.server_errors.fetch_add(1, Ordering::Relaxed);
            }
        }
    }

    pub fn snapshot(&self) -> StatsSnapshot {
        StatsSnapshot {
            total_requests: self.total_requests.load(Ordering::Relaxed),
            successful: self.successful.load(Ordering::Relaxed),
            failed: self.failed.load(Ordering::Relaxed),
            rate_limited: self.rate_limited.load(Ordering::Relaxed),
            server_errors: self.server_errors.load(Ordering::Relaxed),
        }
    }
}

/// Snapshot of statistics at a point in time
#[derive(Debug, Clone, Default)]
pub struct StatsSnapshot {
    pub total_requests: u64,
    pub successful: u64,
    pub failed: u64,
    pub rate_limited: u64,
    pub server_errors: u64,
}

/// Benchmark runner
pub struct BenchmarkRunner {
    config: ScenarioConfig,
    server_url: String,
    project_id: u32,
    sentry_key: String,
    client: Client,
    container_name: Option<String>,
}

impl BenchmarkRunner {
    /// Create a new benchmark runner
    pub fn new(
        config: ScenarioConfig,
        server_url: &str,
        project_id: u32,
        sentry_key: &str,
    ) -> Result<Self, RunnerError> {
        // Validate URL
        if !server_url.starts_with("http://") && !server_url.starts_with("https://") {
            return Err(RunnerError::InvalidUrl(server_url.to_string()));
        }

        let client = Client::builder()
            .pool_max_idle_per_host(config.concurrency as usize)
            .timeout(Duration::from_secs(30))
            .build()?;

        Ok(Self {
            config,
            server_url: server_url.trim_end_matches('/').to_string(),
            project_id,
            sentry_key: sentry_key.to_string(),
            client,
            container_name: None,
        })
    }

    /// Set the container name for metrics collection
    pub fn with_container(mut self, container_name: &str) -> Self {
        self.container_name = Some(container_name.to_string());
        self
    }

    /// Get the envelope endpoint URL
    fn envelope_url(&self) -> String {
        format!(
            "{}/api/{}/envelope/?sentry_key={}",
            self.server_url, self.project_id, self.sentry_key
        )
    }

    /// Wait for server to be ready
    pub async fn wait_for_server(&self, timeout_secs: u64) -> Result<(), RunnerError> {
        let health_url = format!("{}/health", self.server_url);
        let start = Instant::now();

        println!("{}", "Waiting for server to be ready...".dimmed());

        while start.elapsed() < Duration::from_secs(timeout_secs) {
            match self.client.get(&health_url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    println!("{}", "Server is ready!".green());
                    return Ok(());
                }
                _ => {
                    tokio::time::sleep(Duration::from_millis(500)).await;
                }
            }
        }

        Err(RunnerError::ServerNotReady(timeout_secs))
    }

    /// Send a single request and measure latency
    async fn send_request(&self, envelope: Vec<u8>) -> RequestResult {
        let start = Instant::now();

        let result = self
            .client
            .post(&self.envelope_url())
            .header("Content-Type", "application/x-sentry-envelope")
            .header("Content-Encoding", "gzip")
            .body(envelope)
            .send()
            .await;

        let latency_us = start.elapsed().as_micros() as u64;

        match result {
            Ok(resp) => {
                let status = resp.status().as_u16();
                RequestResult {
                    latency_us,
                    status,
                    success: resp.status().is_success(),
                }
            }
            Err(_) => RequestResult {
                latency_us,
                status: 0,
                success: false,
            },
        }
    }

    /// Run warmup phase
    async fn warmup(&self, generator: &mut EnvelopeGenerator) {
        if self.config.warmup_secs == 0 {
            return;
        }

        let pb = ProgressBar::new(self.config.warmup_secs);
        pb.set_style(
            ProgressStyle::default_bar()
                .template("{spinner:.yellow} {msg} [{bar:40.yellow}] {pos}/{len}s")
                .unwrap()
                .progress_chars("=> "),
        );
        pb.set_message("Warming up");

        let duration = Duration::from_secs(self.config.warmup_secs);
        let start = Instant::now();

        while start.elapsed() < duration {
            let envelope = generator.generate_compressed_envelope(None);
            let _ = self.send_request(envelope).await;
            pb.set_position(start.elapsed().as_secs());
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        pb.finish_with_message("Warmup complete");
    }

    /// Run sustained load scenario
    async fn run_sustained(&self, generator: Arc<Mutex<EnvelopeGenerator>>) -> BenchmarkResults {
        let stats = Arc::new(LiveStats::default());
        let histogram = Arc::new(Mutex::new(
            Histogram::<u64>::new_with_bounds(1, 60_000_000, 3).unwrap(),
        ));

        let duration = Duration::from_secs(self.config.duration_secs);
        let interval_ns = 1_000_000_000 / self.config.target_rps;

        let pb = ProgressBar::new(self.config.duration_secs);
        pb.set_style(
            ProgressStyle::default_bar()
                .template("{spinner:.green} {msg} [{bar:40.green}] {pos}/{len}s | {per_sec}")
                .unwrap()
                .progress_chars("=> "),
        );
        pb.set_message("Running sustained load");

        let start = Instant::now();

        // Spawn worker tasks
        let mut handles = Vec::new();

        for _ in 0..self.config.concurrency {
            let client = self.client.clone();
            let url = self.envelope_url();
            let stats = stats.clone();
            let histogram = histogram.clone();
            let generator = generator.clone();
            let rate_limit = Duration::from_nanos(interval_ns * self.config.concurrency as u64);

            let handle = tokio::spawn(async move {
                let mut interval = interval(rate_limit);

                while start.elapsed() < duration {
                    interval.tick().await;

                    let envelope = {
                        let mut gen = generator.lock().await;
                        gen.generate_compressed_envelope(None)
                    };

                    let req_start = Instant::now();
                    let result = client
                        .post(&url)
                        .header("Content-Type", "application/x-sentry-envelope")
                        .header("Content-Encoding", "gzip")
                        .body(envelope)
                        .send()
                        .await;

                    let latency_us = req_start.elapsed().as_micros() as u64;

                    let request_result = match result {
                        Ok(resp) => {
                            let status = resp.status().as_u16();
                            RequestResult {
                                latency_us,
                                status,
                                success: resp.status().is_success(),
                            }
                        }
                        Err(_) => RequestResult {
                            latency_us,
                            status: 0,
                            success: false,
                        },
                    };

                    stats.record(&request_result);

                    if let Ok(mut hist) = histogram.try_lock() {
                        let _ = hist.record(latency_us);
                    }
                }
            });

            handles.push(handle);
        }

        // Progress updates
        while start.elapsed() < duration {
            pb.set_position(start.elapsed().as_secs());
            let snapshot = stats.snapshot();
            let rps = snapshot.total_requests as f64 / start.elapsed().as_secs_f64();
            pb.set_message(format!(
                "RPS: {:.0} | OK: {} | Fail: {}",
                rps, snapshot.successful, snapshot.failed
            ));
            tokio::time::sleep(Duration::from_millis(500)).await;
        }

        // Wait for all workers
        for handle in handles {
            handle.abort();
        }

        pb.finish_with_message("Sustained load complete");

        let total_duration = start.elapsed();
        let snapshot = stats.snapshot();
        let hist = histogram.lock().await;

        BenchmarkResults::new(
            &self.config,
            snapshot,
            &hist,
            total_duration,
            None, // Metrics collected separately
        )
    }

    /// Run burst scenario
    async fn run_burst(&self, generator: Arc<Mutex<EnvelopeGenerator>>) -> BenchmarkResults {
        let stats = Arc::new(LiveStats::default());
        let histogram = Arc::new(Mutex::new(
            Histogram::<u64>::new_with_bounds(1, 60_000_000, 3).unwrap(),
        ));

        let burst_config = &self.config.burst;
        let total_bursts = burst_config.cycles;

        println!(
            "{} bursts of {} events with {}s pause",
            total_bursts.to_string().cyan(),
            burst_config.burst_size.to_string().cyan(),
            burst_config.pause_secs.to_string().cyan()
        );

        let start = Instant::now();

        for cycle in 0..total_bursts {
            let pb = ProgressBar::new(burst_config.burst_size);
            pb.set_style(
                ProgressStyle::default_bar()
                    .template(&format!(
                        "{{spinner:.cyan}} Burst {}/{} [{{bar:40.cyan}}] {{pos}}/{{len}}",
                        cycle + 1,
                        total_bursts
                    ))
                    .unwrap()
                    .progress_chars("=> "),
            );

            // Send burst
            let requests: Vec<_> = (0..burst_config.burst_size)
                .map(|_| {
                    let generator = generator.clone();
                    async move {
                        let mut gen = generator.lock().await;
                        gen.generate_compressed_envelope(None)
                    }
                })
                .collect();

            let envelopes: Vec<Vec<u8>> = futures::future::join_all(requests).await;

            let results: Vec<RequestResult> = stream::iter(envelopes)
                .map(|envelope| {
                    let client = self.client.clone();
                    let url = self.envelope_url();
                    async move {
                        let req_start = Instant::now();
                        let result = client
                            .post(&url)
                            .header("Content-Type", "application/x-sentry-envelope")
                            .header("Content-Encoding", "gzip")
                            .body(envelope)
                            .send()
                            .await;

                        let latency_us = req_start.elapsed().as_micros() as u64;

                        match result {
                            Ok(resp) => {
                                let status = resp.status().as_u16();
                                RequestResult {
                                    latency_us,
                                    status,
                                    success: resp.status().is_success(),
                                }
                            }
                            Err(_) => RequestResult {
                                latency_us,
                                status: 0,
                                success: false,
                            },
                        }
                    }
                })
                .buffer_unordered(self.config.concurrency as usize)
                .inspect(|_| pb.inc(1))
                .collect()
                .await;

            // Record results
            for result in &results {
                stats.record(result);
                if let Ok(mut hist) = histogram.try_lock() {
                    let _ = hist.record(result.latency_us);
                }
            }

            pb.finish();

            // Pause between bursts (except after last)
            if cycle < total_bursts - 1 {
                println!(
                    "{}",
                    format!("Pausing for {}s...", burst_config.pause_secs).dimmed()
                );
                tokio::time::sleep(Duration::from_secs(burst_config.pause_secs)).await;
            }
        }

        let total_duration = start.elapsed();
        let snapshot = stats.snapshot();
        let hist = histogram.lock().await;

        BenchmarkResults::new(&self.config, snapshot, &hist, total_duration, None)
    }

    /// Run baseline scenario
    async fn run_baseline(&self, generator: Arc<Mutex<EnvelopeGenerator>>) -> BenchmarkResults {
        let stats = Arc::new(LiveStats::default());
        let histogram = Arc::new(Mutex::new(
            Histogram::<u64>::new_with_bounds(1, 60_000_000, 3).unwrap(),
        ));

        let duration = Duration::from_secs(self.config.duration_secs);

        let pb = ProgressBar::new(self.config.duration_secs);
        pb.set_style(
            ProgressStyle::default_bar()
                .template("{spinner:.blue} {msg} [{bar:40.blue}] {pos}/{len}s")
                .unwrap()
                .progress_chars("=> "),
        );
        pb.set_message("Baseline measurement");

        let start = Instant::now();

        while start.elapsed() < duration {
            let envelope = {
                let mut gen = generator.lock().await;
                gen.generate_compressed_envelope(None)
            };

            let result = self.send_request(envelope).await;
            stats.record(&result);

            {
                let mut hist = histogram.lock().await;
                let _ = hist.record(result.latency_us);
            }

            pb.set_position(start.elapsed().as_secs());
            pb.set_message(format!(
                "Latency: {:.2}ms",
                result.latency_us as f64 / 1000.0
            ));

            // One request per second for baseline
            tokio::time::sleep(Duration::from_secs(1)).await;
        }

        pb.finish_with_message("Baseline complete");

        let total_duration = start.elapsed();
        let snapshot = stats.snapshot();
        let hist = histogram.lock().await;

        BenchmarkResults::new(&self.config, snapshot, &hist, total_duration, None)
    }

    /// Run stress test scenario
    async fn run_stress(&self, generator: Arc<Mutex<EnvelopeGenerator>>) -> BenchmarkResults {
        let stats = Arc::new(LiveStats::default());
        let histogram = Arc::new(Mutex::new(
            Histogram::<u64>::new_with_bounds(1, 60_000_000, 3).unwrap(),
        ));

        let stress_config = &self.config.stress;
        let mut current_rps = stress_config.initial_rps;

        println!(
            "Starting stress test: {} -> {} RPS (step: {}, duration: {}s per step)",
            stress_config.initial_rps.to_string().cyan(),
            stress_config.max_rps.to_string().cyan(),
            stress_config.rps_increment.to_string().cyan(),
            stress_config.step_duration_secs.to_string().cyan()
        );

        let start = Instant::now();

        while current_rps <= stress_config.max_rps {
            let step_start = Instant::now();
            let step_duration = Duration::from_secs(stress_config.step_duration_secs);
            let interval_ns = 1_000_000_000 / current_rps;

            let pb = ProgressBar::new(stress_config.step_duration_secs);
            pb.set_style(
                ProgressStyle::default_bar()
                    .template(&format!(
                        "{{spinner:.magenta}} {} RPS [{{bar:40.magenta}}] {{pos}}/{{len}}s | OK: {{msg}}",
                        current_rps
                    ))
                    .unwrap()
                    .progress_chars("=> "),
            );

            let step_stats = Arc::new(LiveStats::default());

            // Spawn workers for this step
            let mut handles = Vec::new();

            for _ in 0..self.config.concurrency {
                let client = self.client.clone();
                let url = self.envelope_url();
                let stats = step_stats.clone();
                let global_stats = stats.clone();
                let histogram = histogram.clone();
                let generator = generator.clone();
                let rate_limit = Duration::from_nanos(interval_ns * self.config.concurrency as u64);

                let handle = tokio::spawn(async move {
                    let mut interval = interval(rate_limit);

                    while step_start.elapsed() < step_duration {
                        interval.tick().await;

                        let envelope = {
                            let mut gen = generator.lock().await;
                            gen.generate_compressed_envelope(None)
                        };

                        let req_start = Instant::now();
                        let result = client
                            .post(&url)
                            .header("Content-Type", "application/x-sentry-envelope")
                            .header("Content-Encoding", "gzip")
                            .body(envelope)
                            .send()
                            .await;

                        let latency_us = req_start.elapsed().as_micros() as u64;

                        let request_result = match result {
                            Ok(resp) => {
                                let status = resp.status().as_u16();
                                RequestResult {
                                    latency_us,
                                    status,
                                    success: resp.status().is_success(),
                                }
                            }
                            Err(_) => RequestResult {
                                latency_us,
                                status: 0,
                                success: false,
                            },
                        };

                        stats.record(&request_result);
                        global_stats.record(&request_result);

                        if let Ok(mut hist) = histogram.try_lock() {
                            let _ = hist.record(latency_us);
                        }
                    }
                });

                handles.push(handle);
            }

            // Progress updates
            while step_start.elapsed() < step_duration {
                pb.set_position(step_start.elapsed().as_secs());
                let snapshot = step_stats.snapshot();
                pb.set_message(format!(
                    "{} / fail: {}",
                    snapshot.successful, snapshot.failed
                ));
                tokio::time::sleep(Duration::from_millis(500)).await;
            }

            // Stop workers
            for handle in handles {
                handle.abort();
            }

            pb.finish();

            // Check error rate
            let snapshot = step_stats.snapshot();
            let error_rate = if snapshot.total_requests > 0 {
                snapshot.failed as f64 / snapshot.total_requests as f64
            } else {
                0.0
            };

            if error_rate > stress_config.error_threshold {
                println!(
                    "{}",
                    format!(
                        "Error threshold exceeded ({:.1}% > {:.1}%), stopping stress test",
                        error_rate * 100.0,
                        stress_config.error_threshold * 100.0
                    )
                    .red()
                );
                break;
            }

            current_rps += stress_config.rps_increment;
        }

        let total_duration = start.elapsed();
        let snapshot = stats.snapshot();
        let hist = histogram.lock().await;

        BenchmarkResults::new(&self.config, snapshot, &hist, total_duration, None)
    }

    /// Run the benchmark scenario
    pub async fn run(&self) -> Result<BenchmarkResults, RunnerError> {
        println!(
            "\n{} {} {}",
            "Running scenario:".bold(),
            self.config.name.cyan().bold(),
            format!("({})", self.config.scenario_type).dimmed()
        );
        println!("{}", self.config.description.dimmed());
        println!();

        // Create event generator
        let event_config = EventConfig {
            breadcrumb_count: self.config.event.breadcrumb_count,
            stack_depth: self.config.event.stack_depth,
            include_user: self.config.event.include_user,
            include_tags: self.config.event.include_tags,
            include_extra: self.config.event.include_extra,
            environment: "benchmark".to_string(),
            release: "rustrak-bench@0.1.0".to_string(),
            error_type: "BenchmarkError".to_string(),
        };
        let generator = Arc::new(Mutex::new(EnvelopeGenerator::new(event_config)));

        // Warmup
        {
            let mut gen = generator.lock().await;
            self.warmup(&mut gen).await;
        }

        // Start metrics collection if container specified
        let metrics_collector = if let Some(ref container) = self.container_name {
            match MetricsCollector::new(container).await {
                Ok(collector) => {
                    collector.start();
                    Some(collector)
                }
                Err(e) => {
                    eprintln!(
                        "{}",
                        format!("Warning: Could not start metrics collection: {}", e).yellow()
                    );
                    None
                }
            }
        } else {
            None
        };

        // Run the appropriate scenario
        let mut results = match self.config.scenario_type {
            ScenarioType::Baseline => self.run_baseline(generator).await,
            ScenarioType::Burst => self.run_burst(generator).await,
            ScenarioType::Sustained => self.run_sustained(generator).await,
            ScenarioType::Stress => self.run_stress(generator).await,
        };

        // Stop metrics collection and get results
        if let Some(collector) = metrics_collector {
            let container_metrics = collector.stop().await;
            results = results.with_container_metrics(container_metrics);
        }

        Ok(results)
    }
}
