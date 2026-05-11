"""Tests for gather_release_data.py"""
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from gather_release_data import parse_changelog, main as gather_main


SAMPLE_CHANGELOG = """# @rustrak/server

## 0.3.0

### Minor Changes

- SQLite is now the default database backend

### Patch Changes

- Upgrade all dependencies to latest versions

## 0.2.0

### Minor Changes

- Initial release
"""

SAMPLE_CHANGELOG_WITH_PR_LINKS = """# @rustrak/client

## 1.0.0

### Major Changes

- [#44](https://github.com/AbianS/rustrak/pull/44) [`4a84415`](https://github.com/AbianS/rustrak/commit/4a84415) Thanks [@AbianS](https://github.com/AbianS)! - Added full TypeScript client
"""


def _write_changelog(tmp: Path, content: str) -> Path:
    path = tmp / "CHANGELOG.md"
    path.write_text(content, encoding="utf-8")
    return path


def test_parse_basic_changelog(tmp_path):
    path = _write_changelog(tmp_path, SAMPLE_CHANGELOG)
    result = parse_changelog(path)

    assert result is not None
    assert result["package"] == "@rustrak/server"
    assert result["version"] == "0.3.0"
    assert "Minor Changes" in result["changes"]
    assert "SQLite is now the default database backend" in result["changes"]["Minor Changes"]
    assert "Patch Changes" in result["changes"]


def test_parse_only_latest_version(tmp_path):
    path = _write_changelog(tmp_path, SAMPLE_CHANGELOG)
    result = parse_changelog(path)
    # Should only return the first (latest) version
    assert result["version"] == "0.3.0"
    # The 0.2.0 "Initial release" change should NOT be in the result
    for items in result["changes"].values():
        assert "Initial release" not in items


def test_parse_strips_pr_links(tmp_path):
    path = _write_changelog(tmp_path, SAMPLE_CHANGELOG_WITH_PR_LINKS)
    result = parse_changelog(path)
    assert result is not None
    assert result["version"] == "1.0.0"
    changes = result["changes"].get("Major Changes", [])
    assert len(changes) == 1
    assert "Added full TypeScript client" in changes[0]
    assert "github.com" not in changes[0]
    assert "Thanks" not in changes[0]


def test_parse_missing_file(tmp_path):
    result = parse_changelog(tmp_path / "nonexistent.md")
    assert result is None


def test_parse_empty_changelog(tmp_path):
    path = _write_changelog(tmp_path, "# @rustrak/empty\n\nNo releases yet.\n")
    result = parse_changelog(path)
    assert result is None


def test_main_with_mock_project(tmp_path):
    """Integration test: main() with a mock project structure."""
    # Create mock directory structure
    (tmp_path / "apps" / "server").mkdir(parents=True)
    (tmp_path / "apps" / "webview-ui").mkdir(parents=True)
    (tmp_path / "apps" / "docs").mkdir(parents=True)
    (tmp_path / "packages" / "client").mkdir(parents=True)

    (tmp_path / "apps" / "server" / "CHANGELOG.md").write_text(SAMPLE_CHANGELOG)

    output_file = tmp_path / "output.json"

    sys.argv = ["gather_release_data.py", str(tmp_path), "-o", str(output_file)]
    try:
        gather_main()
    except SystemExit as e:
        assert e.code in (0, 1)  # 1 because other changelogs are missing (medium findings)

    result = json.loads(output_file.read_text())
    assert result["release"]["version"] == "0.3.0"
    assert result["release"]["aggregated_changes"].get("Minor Changes")


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
