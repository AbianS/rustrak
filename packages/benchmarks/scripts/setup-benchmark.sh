#!/bin/bash
# Setup script for benchmark environment
# Creates a test project and saves credentials for the benchmark tool

set -e

SERVER_URL="${SERVER_URL:-http://localhost:8080}"
SUPERUSER_EMAIL="bench@test.local"
SUPERUSER_PASSWORD="benchpass123"
PROJECT_NAME="benchmark-project"
CREDENTIALS_FILE="$(dirname "$0")/../.bench-credentials"

echo "🔧 Setting up benchmark environment..."

# Wait for server to be ready
echo "⏳ Waiting for server at $SERVER_URL..."
max_attempts=60
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s "$SERVER_URL/health" > /dev/null 2>&1; then
        echo "✅ Server is ready!"
        break
    fi
    attempt=$((attempt + 1))
    sleep 1
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ Server not ready after ${max_attempts}s"
    exit 1
fi

# Small delay to ensure migrations are complete
sleep 2

# Login to get session cookie
echo "🔐 Logging in as superuser..."
LOGIN_RESPONSE=$(curl -s -c /tmp/bench-cookies.txt -b /tmp/bench-cookies.txt \
    -X POST "$SERVER_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$SUPERUSER_EMAIL\", \"password\": \"$SUPERUSER_PASSWORD\"}")

if echo "$LOGIN_RESPONSE" | grep -q "error"; then
    echo "❌ Login failed: $LOGIN_RESPONSE"
    exit 1
fi
echo "✅ Logged in successfully"

# Check if project already exists
echo "📦 Checking for existing benchmark project..."
PROJECTS_RESPONSE=$(curl -s -b /tmp/bench-cookies.txt "$SERVER_URL/api/projects")

if echo "$PROJECTS_RESPONSE" | grep -q "$PROJECT_NAME"; then
    echo "✅ Benchmark project already exists"
    # Extract project info
    PROJECT_ID=$(echo "$PROJECTS_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
    SENTRY_KEY=$(echo "$PROJECTS_RESPONSE" | grep -o '"sentry_key":"[^"]*"' | head -1 | cut -d'"' -f4)
else
    # Create benchmark project
    echo "📦 Creating benchmark project..."
    CREATE_RESPONSE=$(curl -s -b /tmp/bench-cookies.txt \
        -X POST "$SERVER_URL/api/projects" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$PROJECT_NAME\", \"slug\": \"benchmark\"}")

    if echo "$CREATE_RESPONSE" | grep -q "error"; then
        echo "❌ Failed to create project: $CREATE_RESPONSE"
        exit 1
    fi

    PROJECT_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | cut -d: -f2)
    SENTRY_KEY=$(echo "$CREATE_RESPONSE" | grep -o '"sentry_key":"[^"]*"' | cut -d'"' -f4)
    echo "✅ Created project with ID: $PROJECT_ID"
fi

# Save credentials to file
echo "💾 Saving credentials..."
cat > "$CREDENTIALS_FILE" << EOF
# Benchmark credentials (auto-generated)
# Do not commit this file
PROJECT_ID=$PROJECT_ID
SENTRY_KEY=$SENTRY_KEY
SERVER_URL=$SERVER_URL
EOF

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Benchmark environment ready!"
echo ""
echo "   Project ID:  $PROJECT_ID"
echo "   Sentry Key:  $SENTRY_KEY"
echo "   Server URL:  $SERVER_URL"
echo ""
echo "Run benchmark with:"
echo "   cargo run --release -- --project-id $PROJECT_ID --sentry-key $SENTRY_KEY"
echo ""
echo "Or simply:"
echo "   pnpm bench"
echo "════════════════════════════════════════════════════════════"

# Cleanup
rm -f /tmp/bench-cookies.txt
