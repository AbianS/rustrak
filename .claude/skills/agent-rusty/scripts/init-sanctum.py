#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# ///
"""
Rusty — First Breath scaffolding.

Creates the sanctum folder structure, copies template files with variable
substitution, copies capability reference files into the sanctum, and
auto-generates CAPABILITIES.md from capability frontmatter.

After this script runs, the sanctum is fully self-contained.

Usage:
    python3 init-sanctum.py <project-root> <skill-path>
"""

import sys
import re
import shutil
import argparse
from datetime import date
from pathlib import Path

SKILL_NAME = "agent-rusty"
SANCTUM_DIR = SKILL_NAME

# Files that stay in the skill bundle (only used during First Breath)
SKILL_ONLY_FILES = {"first-breath.md"}

TEMPLATE_FILES = [
    "INDEX-template.md",
    "PERSONA-template.md",
    "CREED-template.md",
    "BOND-template.md",
    "MEMORY-template.md",
    "CAPABILITIES-template.md",
]

EVOLVABLE = True


def parse_toml_config(config_path: Path) -> dict:
    """Parse simple TOML key=value pairs, ignoring section headers."""
    config = {}
    if not config_path.exists():
        return config
    with open(config_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or line.startswith("["):
                continue
            if "=" in line:
                key, _, value = line.partition("=")
                value = value.strip().strip("'\"")
                if value:
                    config[key.strip()] = value
    return config


def parse_frontmatter(file_path: Path) -> dict:
    """Extract YAML frontmatter from a markdown file."""
    meta = {}
    try:
        content = file_path.read_text()
    except OSError:
        return meta
    match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return meta
    for line in match.group(1).strip().split("\n"):
        if ":" in line:
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip().strip("'\"")
    return meta


def copy_references(source_dir: Path, dest_dir: Path) -> list[str]:
    """Copy reference files (except skill-only) into the sanctum."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    copied = []
    for source_file in sorted(source_dir.iterdir()):
        if source_file.name in SKILL_ONLY_FILES:
            continue
        if source_file.is_file():
            shutil.copy2(source_file, dest_dir / source_file.name)
            copied.append(source_file.name)
    return copied


def discover_capabilities(references_dir: Path, sanctum_refs_path: str) -> list[dict]:
    """Scan references/ for capability files with name + code frontmatter."""
    capabilities = []
    for md_file in sorted(references_dir.glob("*.md")):
        if md_file.name in SKILL_ONLY_FILES:
            continue
        meta = parse_frontmatter(md_file)
        if meta.get("name") and meta.get("code"):
            capabilities.append({
                "name": meta["name"],
                "description": meta.get("description", ""),
                "code": meta["code"],
                "source": f"{sanctum_refs_path}/{md_file.name}",
            })
    return capabilities


def generate_capabilities_md(capabilities: list[dict]) -> str:
    """Generate CAPABILITIES.md content from discovered capabilities."""
    lines = [
        "# Capabilities",
        "",
        "## Built-in",
        "",
        "| Code | Name | Description | Source |",
        "|------|------|-------------|--------|",
    ]
    for cap in capabilities:
        lines.append(
            f"| [{cap['code']}] | {cap['name']} | {cap['description']} | `{cap['source']}` |"
        )
    lines.extend([
        "",
        "## Learned",
        "",
        "_Capabilities added by the owner over time. Prompts live in `capabilities/`._",
        "",
        "| Code | Name | Description | Source | Added |",
        "|------|------|-------------|--------|-------|",
        "",
        "## How to Add a Capability",
        "",
        'Tell me "I want you to be able to do X" and we\'ll create it together.',
        "I'll write the prompt, save it to `capabilities/`, and register it here.",
        "Next session, I'll know how.",
        "Load `references/capability-authoring.md` for the full creation framework.",
        "",
        "## Tools",
        "",
        "### Repos (machine-local, never committed)",
        "- `~/.rusty/relay-repo/` — getsentry/relay sparse clone",
        "- `~/.rusty/sentry-data-schemas/` — getsentry/sentry-data-schemas full clone",
        "",
        "### User-Provided Tools",
        "_MCP servers, APIs, or services the owner has made available. Document them here._",
    ])
    return "\n".join(lines) + "\n"


def substitute_vars(content: str, variables: dict) -> str:
    """Replace {var_name} placeholders with values."""
    for key, value in variables.items():
        content = content.replace(f"{{{key}}}", value)
    return content


def main():
    parser = argparse.ArgumentParser(
        description="Rusty First Breath — scaffold the sanctum folder structure from skill templates.",
    )
    parser.add_argument("project_root", help="Root of the project (where _bmad/ lives)")
    parser.add_argument("skill_path", help="Path to the agent-rusty skill directory")
    args = parser.parse_args()

    project_root = Path(args.project_root).resolve()
    skill_path = Path(args.skill_path).resolve()

    bmad_dir = project_root / "_bmad"
    sanctum_path = bmad_dir / "_memory" / SANCTUM_DIR
    assets_dir = skill_path / "assets"
    references_dir = skill_path / "references"

    sanctum_refs = sanctum_path / "references"
    sanctum_refs_path = "./references"

    if sanctum_path.exists():
        print(f"Sanctum already exists at {sanctum_path}")
        print("Rusty has already been born. Skipping First Breath scaffolding.")
        sys.exit(0)

    # Load config from TOML files
    config = {}
    for config_file in ["config.toml", "config.user.toml"]:
        config.update(parse_toml_config(bmad_dir / config_file))

    today = date.today().isoformat()
    variables = {
        "user_name": config.get("user_name", "friend"),
        "communication_language": config.get("communication_language", "English"),
        "birth_date": today,
        "project_root": str(project_root),
        "sanctum_path": str(sanctum_path),
    }

    sanctum_path.mkdir(parents=True, exist_ok=True)
    (sanctum_path / "capabilities").mkdir(exist_ok=True)
    (sanctum_path / "sessions").mkdir(exist_ok=True)
    print(f"Created sanctum at {sanctum_path}")

    copied_refs = copy_references(references_dir, sanctum_refs)
    print(f"  Copied {len(copied_refs)} reference files to sanctum/references/")
    for name in copied_refs:
        print(f"    - {name}")

    for template_name in TEMPLATE_FILES:
        template_path = assets_dir / template_name
        if not template_path.exists():
            print(f"  Warning: template {template_name} not found, skipping")
            continue
        output_name = template_name.replace("-template", "").upper()[:-3] + ".md"
        content = template_path.read_text()
        content = substitute_vars(content, variables)
        (sanctum_path / output_name).write_text(content)
        print(f"  Created {output_name}")

    capabilities = discover_capabilities(references_dir, sanctum_refs_path)
    (sanctum_path / "CAPABILITIES.md").write_text(
        generate_capabilities_md(capabilities)
    )
    print(f"  Created CAPABILITIES.md ({len(capabilities)} built-in capabilities)")

    print()
    print("First Breath scaffolding complete.")
    print("Rusty is ready to be born.")
    print(f"Sanctum: {sanctum_path}")


if __name__ == "__main__":
    main()
