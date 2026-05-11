#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "playwright>=1.40",
# ]
# ///
"""
Renders a Rustrak release card as a 1200×630 PNG using Playwright + HTML template.
Downloads Chromium automatically on first run (~150MB, one-time).

Usage:
  uv run render_release_card.py --version 0.2.1 --output /path/to/card.png
  uv run render_release_card.py --version 0.2.1 --output card.png --skill-root /path/to/skill
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def ensure_browser(verbose: bool = False) -> None:
    """Install Playwright's Chromium on first use. Idempotent — fast if already installed."""
    if verbose:
        print("[render] Ensuring Chromium is available...", file=sys.stderr)
    result = subprocess.run(
        [sys.executable, "-m", "playwright", "install", "chromium"],
        capture_output=not verbose,
        check=False,
    )
    if result.returncode != 0 and not verbose:
        print("[render] Warning: playwright install chromium failed; browser may be missing.", file=sys.stderr)


def render(version: str, template: Path, output: Path, verbose: bool = False) -> None:
    from playwright.sync_api import sync_playwright

    html = template.read_text(encoding="utf-8").replace("{{VERSION}}", version)

    output.parent.mkdir(parents=True, exist_ok=True)
    tmp = output.parent / ".release-card-temp.html"
    tmp.write_text(html, encoding="utf-8")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            context = browser.new_context(
                viewport={"width": 1200, "height": 630},
                device_scale_factor=2,
            )
            page = context.new_page()
            page.goto(f"file://{tmp.resolve()}", wait_until="networkidle")
            page.screenshot(
                path=str(output),
                clip={"x": 0, "y": 0, "width": 1200, "height": 630},
            )
            browser.close()
    finally:
        tmp.unlink(missing_ok=True)

    if verbose:
        print(f"[render] Saved {output}  (2400×1260px @2x)", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--version",    required=True, help="Release version (e.g. 0.2.1)")
    parser.add_argument("--output",     required=True, help="Output PNG path")
    parser.add_argument("--skill-root", default=None,  help="Skill root dir (default: two levels up from script)")
    parser.add_argument("--verbose",    action="store_true")
    args = parser.parse_args()

    skill_root = Path(args.skill_root) if args.skill_root else Path(__file__).parent.parent
    template   = skill_root / "assets" / "release-card.html"
    output     = Path(args.output)
    status, error = "pass", None

    ensure_browser(verbose=args.verbose)

    try:
        render(args.version, template, output, verbose=args.verbose)
    except Exception as exc:
        import traceback
        status, error = "fail", str(exc)
        traceback.print_exc(file=sys.stderr)

    err_lower = (error or "").lower()
    if "executable" in err_lower or "playwright" in err_lower or "chromium" in err_lower:
        fix_hint = "Run: uv run --with playwright playwright install chromium"
    elif "no such file" in err_lower or "not found" in err_lower:
        fix_hint = f"Verify the HTML template exists at {template}"
    elif "permission" in err_lower:
        fix_hint = f"Check write permissions for {output}"
    else:
        fix_hint = "See traceback above for details."

    result = {
        "script":    "render_release_card",
        "version":   "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status":    status,
        "output":    str(output) if status == "pass" else None,
        "findings":  [] if status == "pass" else [{
            "severity": "critical", "category": "structure",
            "location": {"file": "render", "line": 0},
            "issue":    error,
            "fix":      fix_hint,
        }],
        "summary": {
            "total":    0 if status == "pass" else 1,
            "critical": 0 if status == "pass" else 1,
            "high": 0, "medium": 0, "low": 0,
        },
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))
    sys.exit(0 if status == "pass" else 1)


if __name__ == "__main__":
    main()
