#!/bin/bash
# Run benchmark using saved credentials

set -e

SCRIPT_DIR="$(dirname "$0")"
CREDENTIALS_FILE="$SCRIPT_DIR/../.bench-credentials"
SCENARIO="${1:-sustained}"

# Check if credentials file exists
if [ ! -f "$CREDENTIALS_FILE" ]; then
    echo "❌ Credentials file not found. Run 'pnpm prepare-env' first."
    exit 1
fi

# Load credentials
source "$CREDENTIALS_FILE"

echo "🚀 Running $SCENARIO benchmark..."
echo "   Server: $SERVER_URL"
echo "   Project: $PROJECT_ID"
echo ""

# Run benchmark
cd "$SCRIPT_DIR/.."
EXTRA_ARGS=()

# Engine statistics and the read scenario's auth are optional: a credentials
# file written before these existed still works, just without those sections.
if [ -n "${BENCH_POSTGRES_URL:-}" ]; then
    EXTRA_ARGS+=(--postgres-url "$BENCH_POSTGRES_URL")
    EXTRA_ARGS+=(--postgres-container rustrak-postgres-bench)
fi
if [ -n "${BENCH_API_TOKEN:-}" ]; then
    EXTRA_ARGS+=(--api-token "$BENCH_API_TOKEN")
fi

cargo run --release -- \
    --server "$SERVER_URL" \
    --project-id "$PROJECT_ID" \
    --sentry-key "$SENTRY_KEY" \
    --scenario "$SCENARIO" \
    --container rustrak-server-bench \
    "${EXTRA_ARGS[@]}" \
    "${@:2}"
