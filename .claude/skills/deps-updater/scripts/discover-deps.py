#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""
Prepass script for deps-updater: scans the workspace and emits a compact JSON
manifest of all external dependencies. Run from the project root or pass
paths via --workspace.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path


EXCLUDE_DIRS = {"node_modules", ".next", "target", ".git", "dist", ".turbo", "build", "__pycache__", ".cache", ".pnpm-store"}

def find_package_json_files(workspace_dirs):
    for d in workspace_dirs:
        for p in Path(d).rglob("package.json"):
            parts = p.parts
            if any(excl in parts for excl in EXCLUDE_DIRS):
                continue
            yield p


def find_cargo_toml_files(workspace_dirs):
    for d in workspace_dirs:
        for p in Path(d).rglob("Cargo.toml"):
            parts = p.parts
            if any(excl in parts for excl in EXCLUDE_DIRS):
                continue
            yield p


def read_json(path):
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return None


def parse_workspace_paths(root_pkg):
    """Resolve workspace directories from root package.json workspaces field."""
    ws = root_pkg.get("workspaces", [])
    if isinstance(ws, dict):
        ws = ws.get("packages", [])
    return list(ws)


def matches_glob(name, patterns):
    """Check if name matches any glob pattern."""
    import fnmatch
    return any(fnmatch.fnmatch(name, p) for p in patterns)


def is_internal_dep(name, ws_paths, root_dir):
    """Check if name matches any workspace path pattern."""
    # Workspace paths can be like "packages/*" or "apps/*"
    return matches_glob(name, ws_paths)


def resolve_version(version_str):
    """Strip range prefix and return the raw version and whether it was ranged."""
    version_str = version_str.strip()
    ranged = bool(re.match(r'^[\^~>=<]', version_str))
    clean = re.sub(r'^[\^~>=<]', '', version_str).strip()
    # Handle >=1.0.0 or similar
    clean = re.sub(r'^=', '', clean).strip()
    return clean, ranged


def scan_js_deps(ws_dirs, root_dir, scope_packages, skip_packages):
    deps = []
    seen = {}

    for pkg_file in find_package_json_files(ws_dirs):
            data = read_json(pkg_file)
            if not data:
                continue
            # Skip root workspace package if it only has workspaces field
            if pkg_file.parent == root_dir and "workspaces" in data and not data.get("dependencies") and not data.get("devDependencies"):
                continue

            rel_dir = str(pkg_file.parent.relative_to(root_dir)) if root_dir in pkg_file.parent.parents else "."

            for section in ("dependencies", "devDependencies"):
                pkg_data = data.get(section, {})
                for name, ver in pkg_data.items():
                    if scope_packages and name not in scope_packages:
                        continue
                    if name in skip_packages:
                        continue
                    # Skip workspace-protocol deps (pnpm workspace references)
                    if isinstance(ver, str) and ver.startswith("workspace:"):
                        continue
                    clean_ver, ranged = resolve_version(ver)
                    if name in seen:
                        idx = seen[name]
                        if rel_dir not in deps[idx]["workspaces"]:
                            deps[idx]["workspaces"].append(rel_dir)
                    else:
                        seen[name] = len(deps)
                        deps.append({
                            "name": name,
                            "current": clean_ver,
                            "ranged": ranged,
                            "workspaces": [rel_dir],
                        })
    return deps


def scan_rust_deps(root_dir, ws_paths, workspace_members, scope_packages, skip_packages):
    deps = []
    seen = {}

    # Resolve workspace member paths
    member_paths = []
    for member in workspace_members:
        member_paths.append(root_dir / member)

    # If no members defined, use cargo workspace roots
    if not member_paths:
        member_paths = list(ws_paths)

    for cargo_file in find_cargo_toml_files(member_paths):
        text = cargo_file.read_text()
        rel_dir = str(cargo_file.parent.relative_to(root_dir))

        # Simple TOML parsing for dependencies section (avoids external deps)
        in_deps = False
        for line in text.splitlines():
            stripped = line.strip()
            if stripped.startswith("[dependencies]") or stripped.startswith("[dev-dependencies]"):
                in_deps = True
                continue
            if stripped.startswith("[") and in_deps:
                in_deps = False
                continue
            if not in_deps:
                continue
            # Parse lines like: package = "1.0.0" or package = { version = "1.0.0", ... }
            match = re.match(r'^(\w[\w-]*)\s*=\s*"([^"]+)"', stripped)
            if match:
                name = match.group(1)
                ver = match.group(2)
            else:
                match = re.match(r'^(\w[\w-]*)\s*=\s*\{', stripped)
                if match:
                    name = match.group(1)
                    # Skip path/workspace/git deps (not external registry deps)
                    if re.search(r'\b(path|git|workspace)\s*=', stripped):
                        continue
                    # Find version in inline table (always on same line as `=`)
                    ver_match = re.search(r'version\s*=\s*"([^"]+)"', line)
                    if not ver_match:
                        continue
                    ver = ver_match.group(1)
                else:
                    continue

            if scope_packages and name not in scope_packages:
                continue
            if name in skip_packages:
                continue
            clean_ver, ranged = resolve_version(ver)

            if name in seen:
                idx = seen[name]
                if rel_dir not in deps[idx]["workspaces"]:
                    deps[idx]["workspaces"].append(rel_dir)
            else:
                seen[name] = len(deps)
                deps.append({
                    "name": name,
                    "current": clean_ver,
                    "ranged": ranged,
                    "workspaces": [rel_dir],
                })
    return deps


def main():
    parser = argparse.ArgumentParser(description="Discover deps in workspace")
    parser.add_argument("--workspace", "-w", action="append", default=[], help="Workspace dirs to scan")
    parser.add_argument("--packages", "-p", action="append", default=[], help="Only include these packages")
    parser.add_argument("--skip-packages", "-s", action="append", default=[], help="Skip these packages")
    parser.add_argument("--root", default=".", help="Project root directory")
    parser.add_argument("--output", "-o", help="Output file (default: stdout)")
    args = parser.parse_args()

    root_dir = Path(args.root).resolve()
    scope_packages = set(args.packages) if args.packages else set()
    skip_packages = set(args.skip_packages) if args.skip_packages else set()
    explicit_workspaces = args.workspace if args.workspace else None

    root_pkg_file = root_dir / "package.json"
    root_pkg = read_json(root_pkg_file) if root_pkg_file.exists() else {}

    ws_patterns = parse_workspace_paths(root_pkg) if root_pkg else []
    if explicit_workspaces:
        ws_dirs = [root_dir / w for w in explicit_workspaces]
    else:
        ws_dirs = []
        for pattern in ws_patterns:
            expanded = sorted(root_dir.glob(pattern))
            ws_dirs.extend(expanded)
        if not ws_dirs:
            ws_dirs = [root_dir]

    # Filter to dirs that actually exist
    ws_dirs = [d for d in ws_dirs if d.exists()]

    # Rust workspace members
    root_cargo = root_dir / "Cargo.toml"
    workspace_members = []
    if root_cargo.exists():
        text = root_cargo.read_text()
        in_workspace = False
        for line in text.splitlines():
            stripped = line.strip()
            if stripped == "[workspace]":
                in_workspace = True
                continue
            if stripped.startswith("[") and in_workspace:
                in_workspace = False
                continue
            if in_workspace:
                match = re.match(r'^members\s*=\s*\[(.+)\]', stripped)
                if match:
                    members_raw = match.group(1)
                    for m in re.findall(r'"([^"]+)"', members_raw):
                        workspace_members.append(m)

    # Scan
    js_deps = scan_js_deps(ws_dirs, root_dir, scope_packages, skip_packages)
    rust_deps = scan_rust_deps(
        root_dir,
        ws_dirs,
        [root_dir / m for m in workspace_members],
        scope_packages,
        skip_packages,
    )

    ws_paths = {
        "js": sorted(set(
            ws for dep in js_deps for ws in dep["workspaces"]
        )),
        "rust": sorted(set(
            ws for dep in rust_deps for ws in dep["workspaces"]
        )),
    }

    manifest = {
        "js_deps": js_deps,
        "rust_deps": rust_deps,
        "workspace_paths": ws_paths,
        "scope_filters": {
            "packages": sorted(scope_packages),
            "skip_packages": sorted(skip_packages),
        },
    }

    output = json.dumps(manifest, indent=2)
    if args.output:
        Path(args.output).write_text(output)
    else:
        print(output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
