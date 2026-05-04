#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "praw>=7.7",
# ]
# ///
"""
Posts a release announcement to configured Reddit subreddits.

Usage:
  uv run post_to_reddit.py --config .announce.config.toml --title "TITLE" --body-file body.md
  uv run post_to_reddit.py --config .announce.config.toml --title "TITLE" --body "BODY" --dry-run
"""

import argparse
import json
import sys
import tomllib
from datetime import datetime, timezone
from pathlib import Path


def load_config(path: Path) -> dict:
    with open(path, "rb") as f:
        return tomllib.load(f)


def post_to_reddit(config: dict, title: str, body: str, dry_run: bool) -> list[dict]:
    import praw

    rc = config.get("reddit", {})
    reddit = praw.Reddit(
        client_id=rc["client_id"],
        client_secret=rc["client_secret"],
        refresh_token=rc["refresh_token"],
        user_agent=rc.get("user_agent", "rustrak-announce/1.0"),
    )

    results = []
    for sub_name in rc.get("subreddits", []):
        if dry_run:
            results.append({
                "subreddit": sub_name,
                "status": "dry_run",
                "url": f"https://reddit.com/r/{sub_name} (not posted)",
            })
            continue
        try:
            sub = reddit.subreddit(sub_name)
            submission = sub.submit(title=title, selftext=body)
            results.append({
                "subreddit": sub_name,
                "status": "posted",
                "url": submission.url,
                "id": submission.id,
            })
        except Exception as exc:
            results.append({
                "subreddit": sub_name,
                "status": "error",
                "error": str(exc),
            })

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--config", required=True, help="Path to announce.config.toml")
    parser.add_argument("--title", required=True, help="Post title")

    body_group = parser.add_mutually_exclusive_group(required=True)
    body_group.add_argument("--body", help="Post body (markdown string)")
    body_group.add_argument("--body-file", help="Path to file containing post body")

    parser.add_argument("--dry-run", action="store_true", help="Simulate without posting")
    parser.add_argument("-o", "--output", help="Output file (default: stdout)")
    parser.add_argument("--verbose", action="store_true", help="Print diagnostics to stderr")
    args = parser.parse_args()

    config_path = Path(args.config)
    if not config_path.exists():
        print(json.dumps({
            "script": "post_to_reddit",
            "status": "fail",
            "error": f"Config not found: {config_path}",
        }))
        sys.exit(1)

    config = load_config(config_path)

    body = args.body if args.body else Path(args.body_file).read_text(encoding="utf-8")

    if args.verbose:
        print(f"[reddit] Config loaded from {config_path}", file=sys.stderr)
        if args.dry_run:
            print("[reddit] DRY RUN — no posts will be submitted", file=sys.stderr)

    posts = post_to_reddit(config, args.title, body, dry_run=args.dry_run)

    findings = [
        {
            "severity": "high",
            "category": "consistency",
            "location": {"file": "reddit", "line": 0},
            "issue": f"Failed to post to r/{p['subreddit']}: {p.get('error')}",
            "fix": "Check credentials and subreddit posting permissions",
        }
        for p in posts
        if p.get("status") == "error"
    ]

    status = "fail" if findings else "pass"

    result = {
        "script": "post_to_reddit",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "dry_run": args.dry_run,
        "posts": posts,
        "findings": findings,
        "summary": {
            "total": len(findings),
            "critical": 0,
            "high": len(findings),
            "medium": 0,
            "low": 0,
        },
    }

    output = json.dumps(result, indent=2, ensure_ascii=False)

    if args.output:
        Path(args.output).write_text(output, encoding="utf-8")
    else:
        print(output)

    sys.exit(0 if status == "pass" else 1)


if __name__ == "__main__":
    main()
