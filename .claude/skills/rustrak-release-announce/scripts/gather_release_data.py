#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Parses CHANGELOG.md files from Rustrak packages and extracts the latest release data.

Usage:
  python3 gather_release_data.py [PROJECT_ROOT] [-o OUTPUT] [--verbose]

Outputs JSON with release version, per-package changes, and aggregated change list.
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

CHANGELOG_PATHS = [
    "apps/server/CHANGELOG.md",
    "apps/webview-ui/CHANGELOG.md",
    "apps/docs/CHANGELOG.md",
    "packages/client/CHANGELOG.md",
]

VERSION_RE = re.compile(r"^## (\d+\.\d+\.\d+[^\s]*)$")
SECTION_RE = re.compile(r"^### (.+)$")
PR_LINK_RE = re.compile(r"\[#\d+\]\(https?://[^)]+\)\s*")
COMMIT_LINK_RE = re.compile(r"\[`[a-f0-9]+`\]\(https?://[^)]+\)\s*")
THANKS_RE = re.compile(r"Thanks\s+\[@[^\]]+\]\(https?://[^)]+\)!\s*-?\s*")


def _clean_line(line: str) -> str:
    line = PR_LINK_RE.sub("", line)
    line = COMMIT_LINK_RE.sub("", line)
    line = THANKS_RE.sub("", line)
    return line.strip()


def parse_changelog(path: Path) -> dict | None:
    if not path.exists():
        return None

    lines = path.read_text(encoding="utf-8").splitlines()

    package_name = next(
        (l[2:].strip() for l in lines if l.startswith("# ")), None
    )

    version_start = version = None
    for i, line in enumerate(lines):
        m = VERSION_RE.match(line)
        if m:
            version = m.group(1)
            version_start = i
            break

    if version_start is None:
        return None

    version_end = len(lines)
    for i in range(version_start + 1, len(lines)):
        if VERSION_RE.match(lines[i]) or lines[i].startswith("# "):
            version_end = i
            break

    section_lines = lines[version_start + 1 : version_end]

    changes: dict[str, list[str]] = {}
    current_section: str | None = None

    for line in section_lines:
        sm = SECTION_RE.match(line)
        if sm:
            current_section = sm.group(1).strip()
            changes[current_section] = []
            continue

        if current_section is None:
            continue

        stripped = line.strip()
        if not stripped:
            continue

        if stripped.startswith(("- ", "* ")):
            cleaned = _clean_line(stripped[2:])
            if cleaned:
                changes[current_section].append(cleaned)
        elif changes[current_section] and not stripped.startswith("#"):
            cleaned = _clean_line(stripped)
            if cleaned:
                changes[current_section][-1] += " " + cleaned

    return {
        "package": package_name,
        "version": version,
        "changes": {k: v for k, v in changes.items() if v},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("project_root", nargs="?", default=".", help="Path to project root")
    parser.add_argument("-o", "--output", help="Output file (default: stdout)")
    parser.add_argument("--verbose", action="store_true", help="Print diagnostics to stderr")
    args = parser.parse_args()

    root = Path(args.project_root).resolve()
    packages = []
    findings = []

    for rel_path in CHANGELOG_PATHS:
        path = root / rel_path
        if args.verbose:
            print(f"[gather] Reading {path}", file=sys.stderr)

        data = parse_changelog(path)
        if data:
            packages.append(data)
        else:
            findings.append({
                "severity": "medium",
                "category": "structure",
                "location": {"file": rel_path, "line": 0},
                "issue": f"Could not parse CHANGELOG.md at {rel_path}",
                "fix": "Ensure the file exists and has the standard changeset format",
            })

    # Primary version: server package, fallback to first found
    release_version = next(
        (p["version"] for p in packages if p.get("package") == "@rustrak/server"),
        packages[0]["version"] if packages else None,
    )

    # Aggregate changes across all packages, deduped
    aggregated: dict[str, list[str]] = {}
    seen: set[str] = set()

    for pkg in packages:
        for section, items in pkg["changes"].items():
            if section not in aggregated:
                aggregated[section] = []
            for item in items:
                if item and item not in seen:
                    seen.add(item)
                    aggregated[section].append(item)

    status = "fail" if any(f["severity"] in ("critical", "high") for f in findings) else "pass"

    result = {
        "script": "gather_release_data",
        "version": "1.0.0",
        "project_root": str(root),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "release": {
            "version": release_version,
            "packages": packages,
            "aggregated_changes": aggregated,
        },
        "findings": findings,
        "summary": {
            "total": len(findings),
            "critical": sum(1 for f in findings if f["severity"] == "critical"),
            "high": sum(1 for f in findings if f["severity"] == "high"),
            "medium": sum(1 for f in findings if f["severity"] == "medium"),
            "low": sum(1 for f in findings if f["severity"] == "low"),
        },
    }

    output = json.dumps(result, indent=2, ensure_ascii=False)

    if args.output:
        Path(args.output).write_text(output, encoding="utf-8")
        if args.verbose:
            print(f"[gather] Written to {args.output}", file=sys.stderr)
    else:
        print(output)

    sys.exit(0 if status == "pass" else 1)


if __name__ == "__main__":
    main()
