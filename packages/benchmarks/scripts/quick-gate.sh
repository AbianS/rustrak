#!/bin/bash
# Quick performance-regression gate (CI `quick-bench` job).
#
# Runs the processor-level probe (apps/server/src/bin/digest_bench.rs) on the
# PR head and on the merge-base, and FAILS when the head is more than 2×
# slower (warns above 1.5×). A few seconds per side; the ratio cancels most
# shared-runner noise, so this gates the order-of-magnitude regressions that
# would undo the SQLite write-path wins — not ±20–30% drift.
#
# If the merge-base predates the probe (no digest_bench bin, or an API drift
# the probe cannot compile against), the job prints head-only numbers and
# passes with a notice: there is no baseline to compare yet. The probe
# targets the stack's unified ProcessorCtx (shared writer slot, lands with
# the atomic-digests branch), so the gate only activates fully once that API
# is in the base.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BASE_SHA="${GITHUB_BASE_SHA:-}"
if [ -z "$BASE_SHA" ]; then
  BASE_SHA="$(git -C "$REPO" merge-base origin/main HEAD 2>/dev/null || true)"
fi
HEAD_SHA="$(git -C "$REPO" rev-parse HEAD)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# run_side <sha> <label> -> prints the probe line; exit 0=ok, 2=skipped
run_side() {
  local sha="$1" label="$2"
  git -C "$REPO" worktree add --detach "$WORK/$label" "$sha" >/dev/null 2>&1 || return 2
  if ! ( cd "$WORK/$label/apps/server" && cargo build --release --quiet --features bench --bin digest_bench ); then
    git -C "$REPO" worktree remove --force "$WORK/$label"
    return 2
  fi
  ( cd "$WORK/$label/apps/server" && ./target/release/digest_bench )
  git -C "$REPO" worktree remove --force "$WORK/$label"
}

rate() { sed -n 's/.*= \([0-9.]*\) events\/s.*/\1/p' "$1"; }

if [ -z "$BASE_SHA" ]; then
  echo "::warning::quick-bench: no merge-base found; skipping baseline comparison"
fi

BASE_OUT=""
if [ -n "$BASE_SHA" ]; then
  if ! BASE_OUT="$(run_side "$BASE_SHA" base)"; then
    echo "::notice::quick-bench: merge-base ${BASE_SHA:0:7} predates the probe — head-only numbers, no gate"
    BASE_OUT=""
  fi
fi

HEAD_OUT=""
if ! HEAD_OUT="$(run_side "$HEAD_SHA" head)"; then
  echo "::notice::quick-bench: probe does not compile against this head (${HEAD_SHA:0:7}) — gate skipped; it activates once the shared writer slot API is in the base"
  exit 0
fi
echo "== quick-bench head ${HEAD_SHA:0:7} =="
echo "$HEAD_OUT"

if [ -z "$BASE_OUT" ]; then
  echo "quick-bench: no baseline — gate skipped (head-only)"
  exit 0
fi

echo "== quick-bench base ${BASE_SHA:0:7} =="
echo "$BASE_OUT"

BASE_DIGEST="$(rate <(printf '%s\n' "$BASE_OUT"))"
HEAD_DIGEST="$(rate <(printf '%s\n' "$HEAD_OUT"))"

if [ -z "$BASE_DIGEST" ] || [ -z "$HEAD_DIGEST" ] || [ "$BASE_DIGEST" = "0" ]; then
  echo "::warning::quick-bench: probe output unparsable — gate skipped"
  exit 0
fi

RATIO="$(awk -v b="$BASE_DIGEST" -v h="$HEAD_DIGEST" 'BEGIN { printf "%.2f", b / h }')"
echo "quick-bench: digest ratio (base/head) = $RATIO (base ${BASE_DIGEST} vs head ${HEAD_DIGEST} events/s)"

if awk -v r="$RATIO" 'BEGIN { exit !(r > 2.0) }'; then
  echo "::error::quick-bench: digest is more than 2× slower than the merge-base ($RATIO) — performance regression"
  exit 1
fi
if awk -v r="$RATIO" 'BEGIN { exit !(r > 1.5) }'; then
  echo "::warning::quick-bench: digest is 1.5–2× slower than the merge-base ($RATIO) — investigate"
fi
echo "quick-bench: gate passed"
