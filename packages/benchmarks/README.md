# Rustrak Benchmarks

A comprehensive benchmarking suite for the Rustrak error tracking server. Measures performance metrics including throughput, latency, memory usage, and CPU consumption in a reproducible, isolated environment.

## Features

- **Custom Sentry Envelope Generator**: Generates valid Sentry envelope payloads with configurable complexity
- **Multiple Scenarios**: Baseline, burst, sustained, and stress test patterns
- **Docker Metrics**: Collects memory and CPU usage from Docker containers
- **JSON Output**: Results saved with timestamps for version comparison
- **Latency Histograms**: HDR histograms for accurate P50/P95/P99 measurements

## Quick Start

### Prerequisites

- Rust 1.75+
- Docker and Docker Compose
- A running Rustrak server (or use the included Docker setup)

### Using Docker Compose (Recommended)

```bash
# Start environment and auto-setup (creates project, gets credentials)
pnpm docker:up

# Run benchmark (uses saved credentials automatically)
pnpm bench

# View results
cat results/latest.json | jq '.results'

# Clean up
pnpm docker:down
```

The `docker:up` command automatically:
1. Starts PostgreSQL and Rustrak server containers
2. Creates a benchmark project
3. Saves credentials to `.bench-credentials`

### Against an Existing Server

```bash
# Build the benchmark tool
cargo build --release

# Run against your server
cargo run --release -- \
  --server http://localhost:8080 \
  --project-id 1 \
  --sentry-key YOUR_PROJECT_SENTRY_KEY \
  --scenario sustained
```

## Scenarios

| Scenario | Purpose | Configuration |
|----------|---------|---------------|
| `baseline` | Measure baseline latency | 1 req/s for 60s |
| `burst` | Test traffic spike handling | 10k events, 10s pause, 5 cycles |
| `sustained` | Test sustained load & memory | 1k req/s for 5 minutes |
| `stress` | Find server limits | Ramp up until 5% error rate |

### Custom Scenarios

Create a TOML file with your configuration:

```toml
name = "custom"
description = "My custom scenario"
scenario_type = "sustained"

duration_secs = 120
target_rps = 500
concurrency = 25
warmup_secs = 10

[event]
breadcrumb_count = 3
stack_depth = 5
include_user = true
include_tags = true

[docker]
server_cpus = "2"
server_memory = "256M"
```

Run with:
```bash
cargo run --release -- --config-file my-scenario.toml
```

## CLI Usage

```text
rustrak-bench [OPTIONS] [COMMAND]

Commands:
  run      Run a benchmark scenario
  list     List available scenarios
  compare  Compare two benchmark results
  show     Show results from a previous run
  help     Print this message or the help of the given subcommand(s)

Options:
  -s, --scenario <SCENARIO>      Scenario to run [default: sustained]
  -f, --config-file <PATH>       Path to custom scenario TOML file
      --server <URL>             Server URL [default: http://localhost:8080]
      --project-id <ID>          Project ID [default: 1]
      --sentry-key <KEY>         Sentry key for authentication [env: SENTRY_KEY]
      --container <NAME>         Docker container name for metrics
  -o, --output <PATH>            Output directory [default: results]
      --no-warmup                Skip warmup phase
      --wait-timeout <SECS>      Wait for server timeout [default: 30]
      --no-wait                  Skip waiting for server
  -h, --help                     Print help
  -V, --version                  Print version
```

## Output Format

Results are saved as JSON with the following structure:

```json
{
  "run_id": "20260124-sustained-042",
  "timestamp": "2026-01-24T15:30:00Z",
  "scenario": "sustained",
  "config": {
    "duration_secs": 300,
    "target_rps": 1000,
    "concurrency": 50,
    "warmup_secs": 10
  },
  "results": {
    "throughput": {
      "total_requests": 298500,
      "successful": 298450,
      "failed": 50,
      "events_per_second": 995
    },
    "latency_ms": {
      "p50": 8.2,
      "p95": 24.1,
      "p99": 45.3,
      "max": 128.7,
      "min": 2.1,
      "mean": 12.4
    },
    "memory_mb": {
      "idle": 48,
      "peak": 182,
      "average": 124
    },
    "cpu_percent": {
      "peak": 85,
      "average": 62
    },
    "errors": {
      "rate_limited_429": 0,
      "server_error_5xx": 50,
      "connection_failed": 0
    }
  }
}
```

## Comparing Results

Compare two benchmark runs to track performance changes:

```bash
cargo run --release -- compare results/old-run.json results/new-run.json
```

Output:
```text
Comparison: 20260120-sustained-001 → 20260124-sustained-042

Throughput
  Events/sec:  850.00 → 995.00 (+17.1%)

Latency P99
  38.50ms → 45.30ms (+17.7%)

Peak Memory
  165.0MB → 182.0MB (+10.3%)
```

## Docker Metrics Collection

To collect memory and CPU metrics from the server container:

```bash
cargo run --release -- \
  --scenario sustained \
  --container rustrak-server-bench
```

The benchmark tool uses the Docker API (via `bollard`) to poll container stats every second.

## Metrics Collected

### Throughput
- Total requests sent
- Successful requests (2xx responses)
- Failed requests
- Events per second achieved

### Latency
- P50, P95, P99 percentiles
- Min, max, and mean latency
- Measured using HDR histograms

### Memory (with --container)
- Idle memory (before test starts)
- Peak memory usage
- Average memory usage
- Memory limit (if set)

### CPU (with --container)
- Peak CPU usage percentage
- Average CPU usage percentage

### Errors
- Rate limited (429) count
- Server errors (5xx) count
- Connection failures

## Scripts

```bash
# Build release binary
pnpm build

# Start benchmark environment (auto-creates project)
pnpm docker:up

# Re-run setup if needed (creates project, saves credentials)
pnpm prepare-env

# Run default benchmark (sustained)
pnpm bench

# Run specific scenarios
pnpm bench:baseline
pnpm bench:burst
pnpm bench:sustained
pnpm bench:stress

# Stop environment
pnpm docker:down

# View logs
pnpm docker:logs

# Clean results and credentials
pnpm clean
```

## Performance Tips

1. **Use Docker resource limits** for reproducible results
2. **Run multiple times** and compare results
3. **Disable logging** on the server (`RUST_LOG=warn`)
4. **Use release builds** for the benchmark tool
5. **Isolate the network** using the provided docker-compose

## Troubleshooting

### Server not ready

```bash
# Increase wait timeout
cargo run --release -- --wait-timeout 60 --scenario baseline
```

### No metrics collected

Make sure you specify the correct container name:
```bash
docker ps  # Find container name
cargo run --release -- --container rustrak-server-bench --scenario baseline
```

### Rate limiting

The default docker-compose sets very high rate limits. For testing rate limiting behavior, modify the environment variables in `docker-compose.benchmark.yml`.
