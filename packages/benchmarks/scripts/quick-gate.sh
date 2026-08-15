#!/bin/bash
# Quick performance-regression gate (CI `quick-bench` job).
#
# Runs the processor-level probe (apps/server/src/bin/digest_bench.rs) on the
# PR head and on the target branch head, and FAILS when the head is more than
# 2× slower (warns above 1.5×). A few seconds per side; the ratio cancels
# most shared-runner noise, so this gates the order-of-magnitude regressions
# that would undo the SQLite write-path wins — not ±20–30% drift.
#
# Baseline resolution: QUICK_BENCH_BASE_SHA (workflow_dispatch override) >
# GITHUB_BASE_SHA (target branch head at event time) > local merge-base.
#
# Build cache: both sides share one persistent CARGO_TARGET_DIR, so the
# dependency graph — which rarely changes between stacked PR tips — is
# compiled once and reused; only the rustrak crate itself rebuilds per side.
# Fixed worktree paths are reused while their HEAD matches, so consecutive
# runs on the same tips skip even that (fresh checkouts would bump file
# mtimes and invalidate cargo's fingerprints).
#
# If the baseline predates the probe (no digest_bench bin, or an API drift
# the probe cannot compile against), the job prints head-only numbers and
# passes with a notice: there is no baseline to compare yet. The probe
# targets the stack's unified ProcessorCtx (shared writer slot, lands with
# the atomic-digests branch), so the gate only activates fully once that API
# is in the base.
#
# Exit-code contract: run_side returns 2 ONLY for the skip cases above
# (worktree cannot be prepared / probe does not compile). Any other non-zero
# exit comes from the probe itself — a crash or runtime error — which is a
# real regression signal and FAILS the job (head side) or warns (baseline
# side), never a silent pass.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
QB_ROOT="${QUICK_BENCH_ROOT:-/tmp/rustrak-quick-bench}"
TARGET_DIR="$QB_ROOT/target"

BASE_SHA="${QUICK_BENCH_BASE_SHA:-${GITHUB_BASE_SHA:-}}"
if [ -z "$BASE_SHA" ]; then
  BASE_SHA="$(git -C "$REPO" merge-base origin/main HEAD 2>/dev/null || true)"
fi
HEAD_SHA="$(git -C "$REPO" rev-parse HEAD)"

mkdir -p "$TARGET_DIR"

# run_side <sha> <label> -> prints the probe line; exit 0=ok, 1=side failed,
# 2=skipped. For the base side, 2 is a legitimate skip (worktree cannot be
# prepared or the probe does not compile). For the head side, 2 must never be
# returned: a head worktree-prep or build failure is a broken probe and has to
# FAIL the gate (rc 1), never pass it.
# Worktrees live at fixed paths and are REUSED when their HEAD still matches
# AND the tree is clean: a fresh checkout would bump file mtimes and force a
# crate recompile, while an untouched worktree keeps cargo's fingerprints
# valid (deps + crate both cached). Stale, dirty or missing worktrees are
# recreated on demand.
run_side() {
  local sha="$1" label="$2"
  if [ -d "$QB_ROOT/$label" ] \
     && [ "$(git -C "$QB_ROOT/$label" rev-parse HEAD 2>/dev/null || true)" = "$sha" ] \
     && [ -z "$(git -C "$QB_ROOT/$label" status --porcelain 2>/dev/null)" ]; then
    : # reuse as-is (same SHA, clean tree)
  else
    git -C "$REPO" worktree remove --force "$QB_ROOT/$label" 2>/dev/null || true
    if ! git -C "$REPO" worktree add --detach "$QB_ROOT/$label" "$sha" >/dev/null 2>&1; then
      if [ "$label" = "head" ]; then
        echo "::error::quick-bench: head worktree could not be prepared (${sha:0:7}) — a git/path/cache error must not skip the gate" >&2
        return 1
      fi
      return 2
    fi
  fi
  if ! ( cd "$QB_ROOT/$label/apps/server" \
         && cargo build --release --quiet --features bench --bin digest_bench \
              --target-dir "$TARGET_DIR" ); then
    if [ "$label" = "head" ]; then
      echo "::error::quick-bench: probe does not compile against head ${sha:0:7} — the gate must not pass on a broken head probe" >&2
      return 1
    fi
    return 2
  fi
  ( cd "$QB_ROOT/$label/apps/server" && "$TARGET_DIR/release/digest_bench" )
}

rate() { sed -n 's/.*= \([0-9.]*\) events\/s.*/\1/p' "$1"; }

if [ -z "$BASE_SHA" ]; then
  echo "::warning::quick-bench: no baseline found; skipping baseline comparison"
fi

BASE_OUT=""
if [ -n "$BASE_SHA" ]; then
  if BASE_OUT="$(run_side "$BASE_SHA" base)"; then
    : # baseline probe ran
  else
    BASE_RC=$?
    BASE_OUT=""
    if [ "$BASE_RC" -eq 2 ]; then
      echo "::notice::quick-bench: baseline ${BASE_SHA:0:7} predates the probe — head-only numbers, no gate"
    else
      echo "::warning::quick-bench: baseline probe exited $BASE_RC on ${BASE_SHA:0:7} — head-only numbers, no gate"
    fi
  fi
fi

HEAD_OUT=""
if HEAD_OUT="$(run_side "$HEAD_SHA" head)"; then
  : # head probe ran
else
  HEAD_RC=$?
  if [ "$HEAD_RC" -eq 2 ]; then
    echo "::error::quick-bench: head worktree could not be prepared (${HEAD_SHA:0:7}) — the gate must not pass without a head measurement" >&2
    exit 1
  fi
  echo "::error::quick-bench: probe failed ($HEAD_RC) on head ${HEAD_SHA:0:7} — the digest crashed, errored at runtime, or the probe does not compile"
  exit 1
fi
echo "== quick-bench head ${HEAD_SHA:0:7} =="
echo "$HEAD_OUT"

if [ -z "$BASE_OUT" ]; then
  echo "quick-bench: no baseline — gate skipped (head-only; absolute numbers are machine-load dependent, only the ratio is meaningful)"
  exit 0
fi

echo "== quick-bench baseline ${BASE_SHA:0:7} (target branch head) =="
echo "$BASE_OUT"

BASE_DIGEST="$(rate <(printf '%s\n' "$BASE_OUT"))"
HEAD_DIGEST="$(rate <(printf '%s\n' "$HEAD_OUT"))"

if [ -z "$BASE_DIGEST" ] || [ -z "$HEAD_DIGEST" ] || [ "$BASE_DIGEST" = "0" ]; then
  echo "::warning::quick-bench: probe output unparsable — gate skipped"
  exit 0
fi

RATIO="$(awk -v b="$BASE_DIGEST" -v h="$HEAD_DIGEST" 'BEGIN { printf "%.2f", b / h }')"
echo "quick-bench: digest ratio (baseline/head) = $RATIO (baseline ${BASE_DIGEST} vs head ${HEAD_DIGEST} events/s)"

if awk -v r="$RATIO" 'BEGIN { exit !(r > 2.0) }'; then
  echo "::error::quick-bench: digest is more than 2× slower than the baseline ($RATIO) — performance regression"
  exit 1
fi
if awk -v r="$RATIO" 'BEGIN { exit !(r > 1.5) }'; then
  echo "::warning::quick-bench: digest is 1.5–2× slower than the baseline ($RATIO) — investigate"
fi
echo "quick-bench: gate passed"
