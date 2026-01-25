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
cargo run --release -- \
    --server "$SERVER_URL" \
    --project-id "$PROJECT_ID" \
    --sentry-key "$SENTRY_KEY" \
    --scenario "$SCENARIO" \
    "${@:2}"
