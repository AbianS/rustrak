#!/usr/bin/env bash
set -euo pipefail

# Sync version from apps/server/package.json to apps/server/Cargo.toml
# Run after `changeset version` to keep Cargo.toml in sync.

SERVER_DIR="$(cd "$(dirname "$0")/../apps/server" && pwd)"
PACKAGE_JSON="$SERVER_DIR/package.json"
CARGO_TOML="$SERVER_DIR/Cargo.toml"

if [ ! -f "$PACKAGE_JSON" ]; then
  echo "ERROR: $PACKAGE_JSON not found"
  exit 1
fi

VERSION=$(node -p "require('$PACKAGE_JSON').version")

if [ -z "$VERSION" ]; then
  echo "ERROR: could not read version from $PACKAGE_JSON"
  exit 1
fi

if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' -E "s/^version = \".+\"/version = \"$VERSION\"/" "$CARGO_TOML"
else
  sed -i -E "s/^version = \".+\"/version = \"$VERSION\"/" "$CARGO_TOML"
fi

echo "Synced version $VERSION to Cargo.toml"