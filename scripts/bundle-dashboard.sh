#!/usr/bin/env bash
#
# Put the compiled dashboard where the server looks for it.
#
# `apps/dashboard` builds to its own `dist/` -- that is the directory Turbo
# caches, and a task whose output lands in another package would be cached
# under the wrong key. So the copy is a separate, explicit step: the dashboard
# owns `dist/`, the server owns `static/`, and this script is the seam.
#
# `./static` is what `RUSTRAK_DASHBOARD_DIR` defaults to, resolved against the
# working directory, so `cargo run` from `apps/server` finds it with no
# configuration at all.
#
# Missing build is not an error. The server is a complete product without a UI,
# and `cargo build` alone must keep working for anyone who never installs Node.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir="$repo_root/apps/dashboard/dist"
target_dir="$repo_root/apps/server/static"

if [ ! -f "$source_dir/index.html" ]; then
  echo "bundle-dashboard: no build at $source_dir; the server will start API-only" >&2
  rm -rf "$target_dir"
  exit 0
fi

# Replaced rather than merged: a stale hashed chunk left behind by the previous
# build is served happily by the immutable asset mount, and nothing ever
# invalidates it.
rm -rf "$target_dir"
mkdir -p "$target_dir"
cp -R "$source_dir/." "$target_dir/"

echo "bundle-dashboard: $target_dir"
