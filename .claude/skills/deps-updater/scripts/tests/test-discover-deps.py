#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Tests for discover-deps.py."""

import json
import subprocess
import sys
import tempfile
from pathlib import Path


SCRIPT = Path(__file__).parent.parent / "discover-deps.py"


def test_script_exists():
    assert SCRIPT.exists(), f"Script not found: {SCRIPT}"


def test_parseable():
    result = subprocess.run(
        [sys.executable, "-c", f"import py_compile; py_compile.compile('{SCRIPT}', doraise=True)"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, f"Parse error: {result.stderr}"


def test_help():
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--help"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0
    assert "--workspace" in result.stdout


def test_empty_project():
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / "package.json").write_text('{"name":"test","private":true}')
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--root", str(tmp)],
            capture_output=True, text=True,
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert data["js_deps"] == []
        assert data["rust_deps"] == []


def test_single_js_dep():
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / "package.json").write_text('{"name":"test","dependencies":{"left-pad":"1.3.0"}}')
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--root", str(tmp)],
            capture_output=True, text=True,
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert len(data["js_deps"]) == 1
        assert data["js_deps"][0]["name"] == "left-pad"
        assert data["js_deps"][0]["current"] == "1.3.0"


def test_skip_packages():
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / "package.json").write_text('{"name":"test","dependencies":{"foo":"1.0.0","bar":"2.0.0"}}')
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--root", str(tmp), "--skip-packages", "bar"],
            capture_output=True, text=True,
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert len(data["js_deps"]) == 1
        assert data["js_deps"][0]["name"] == "foo"


def test_output_file():
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / "package.json").write_text('{"name":"test","private":true}')
        out_file = tmp / "manifest.json"
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--root", str(tmp), "--output", str(out_file)],
            capture_output=True, text=True,
        )
        assert result.returncode == 0
        assert out_file.exists()
        data = json.loads(out_file.read_text())
        assert "js_deps" in data


def test_rust_dep_extraction():
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / "package.json").write_text('{"name":"test","private":true}')
        (tmp / "Cargo.toml").write_text(
            '[package]\nname = "test"\n[workspace]\n[dependencies]\nserde = "1.0"\ntokio = { version = "1.35", features = ["full"] }\n')
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--root", str(tmp)],
            capture_output=True, text=True,
        )
        assert result.returncode == 0, f"stderr: {result.stderr}"
        data = json.loads(result.stdout)
        dep_names = {d["name"] for d in data["rust_deps"]}
        assert "serde" in dep_names, f"serde not found in {dep_names}"
        assert "tokio" in dep_names, f"tokio not found in {dep_names}"


def test_exclude_workspace_deps():
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / "package.json").write_text(
            '{"name":"test","dependencies":{"left-pad":"1.3.0","@myapp/ui":"workspace:*","@myapp/utils":"workspace:^1.0.0"}}'
        )
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--root", str(tmp)],
            capture_output=True, text=True,
        )
        assert result.returncode == 0, f"stderr: {result.stderr}"
        data = json.loads(result.stdout)
        dep_names = {d["name"] for d in data["js_deps"]}
        assert "left-pad" in dep_names, "external dep should be included"
        assert "@myapp/ui" not in dep_names, "workspace:* dep should be excluded"
        assert "@myapp/utils" not in dep_names, "workspace:^ dep should be excluded"


def test_per_dep_workspace_paths():
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / "package.json").write_text('{"name":"test","workspaces":["packages/*"],"private":true}')
        pkg_dir = tmp / "packages" / "a"
        pkg_dir.mkdir(parents=True)
        (pkg_dir / "package.json").write_text('{"name":"pkg-a","dependencies":{"left-pad":"1.3.0"}}')
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--root", str(tmp)],
            capture_output=True, text=True,
        )
        assert result.returncode == 0, f"stderr: {result.stderr}"
        data = json.loads(result.stdout)
        assert len(data["js_deps"]) == 1
        dep = data["js_deps"][0]
        assert dep["name"] == "left-pad"
        assert "workspaces" in dep, "per-dep workspaces field must be preserved"
        assert "packages/a" in dep["workspaces"], f"expected packages/a in {dep['workspaces']}"


if __name__ == "__main__":
    test_script_exists()
    test_parseable()
    test_help()
    test_empty_project()
    test_single_js_dep()
    test_skip_packages()
    test_output_file()
    test_rust_dep_extraction()
    test_exclude_workspace_deps()
    test_per_dep_workspace_paths()
    print("All tests passed.")
    sys.exit(0)
