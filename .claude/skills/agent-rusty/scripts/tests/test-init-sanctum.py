#!/usr/bin/env python3
"""Unit tests for init-sanctum.py"""
import sys
import tempfile
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))
import importlib.util
spec = importlib.util.spec_from_file_location(
    "init_sanctum",
    Path(__file__).parent.parent / "init-sanctum.py"
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
parse_toml_config = mod.parse_toml_config
parse_frontmatter = mod.parse_frontmatter
substitute_vars = mod.substitute_vars
generate_capabilities_md = mod.generate_capabilities_md


def test_parse_toml_config_reads_key_value():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".toml", delete=False) as f:
        f.write('[core]\nuser_name = "Abian"\ncommunication_language = "Spanish"\n')
        path = Path(f.name)
    result = parse_toml_config(path)
    assert result["user_name"] == "Abian"
    assert result["communication_language"] == "Spanish"
    path.unlink()


def test_parse_toml_config_missing_file():
    result = parse_toml_config(Path("/nonexistent/config.toml"))
    assert result == {}


def test_parse_frontmatter_extracts_fields():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
        f.write("---\nname: search\ncode: SE\ndescription: Search capability\n---\n# Body\n")
        path = Path(f.name)
    result = parse_frontmatter(path)
    assert result["name"] == "search"
    assert result["code"] == "SE"
    assert result["description"] == "Search capability"
    path.unlink()


def test_parse_frontmatter_no_frontmatter():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
        f.write("# Just a heading\nNo frontmatter here.\n")
        path = Path(f.name)
    result = parse_frontmatter(path)
    assert result == {}
    path.unlink()


def test_substitute_vars_replaces_placeholders():
    content = "Hello {user_name}, born {birth_date}."
    result = substitute_vars(content, {"user_name": "Abian", "birth_date": "2026-05-22"})
    assert result == "Hello Abian, born 2026-05-22."


def test_substitute_vars_ignores_unknown():
    content = "Hello {user_name} and {unknown_var}."
    result = substitute_vars(content, {"user_name": "Abian"})
    assert "{user_name}" not in result
    assert "{unknown_var}" in result


def test_generate_capabilities_md_includes_built_in():
    caps = [{"code": "SE", "name": "search", "description": "Search Relay source", "source": "./references/search.md"}]
    md = generate_capabilities_md(caps)
    assert "[SE]" in md
    assert "search" in md
    assert "## Learned" in md
    assert "## How to Add a Capability" in md


def test_generate_capabilities_md_empty_caps():
    md = generate_capabilities_md([])
    assert "## Built-in" in md
    assert "## Learned" in md


if __name__ == "__main__":
    tests = [
        test_parse_toml_config_reads_key_value,
        test_parse_toml_config_missing_file,
        test_parse_frontmatter_extracts_fields,
        test_parse_frontmatter_no_frontmatter,
        test_substitute_vars_replaces_placeholders,
        test_substitute_vars_ignores_unknown,
        test_generate_capabilities_md_includes_built_in,
        test_generate_capabilities_md_empty_caps,
    ]
    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            print(f"  ✓ {test.__name__}")
            passed += 1
        except Exception as e:
            print(f"  ✗ {test.__name__}: {e}")
            failed += 1
    print(f"\n{passed} passed, {failed} failed")
    sys.exit(0 if failed == 0 else 1)
