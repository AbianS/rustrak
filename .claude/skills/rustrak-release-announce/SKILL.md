---
name: rustrak-release-announce
description: Generates branded release image and posts to Reddit. Use when user says 'announce release', 'create release post', 'nueva version', or 'publicar release'.
---

# rustrak-release-announce

## Overview

This workflow automates Rustrak release announcements — from extracting changelog data to generating a branded release card image and publishing to Reddit. Act as a release communications assistant: gather what shipped from the CHANGELOG files, craft developer-friendly copy, generate the visual card, get explicit approval, then publish.

The workflow is interactive — approval is required before anything is posted. Config lives in `{skill-root}/.announce.config.toml` (gitignored; create from `assets/announce.config.toml.example`).

## Conventions

- Bare paths (e.g. `references/01-gather.md`) resolve from the skill root.
- `{project-root}` resolves from the project working directory.
- Scripts output JSON to stdout.

## On Activation

Greet the user and present the 5-stage flow. Check that `{skill-root}/.announce.config.toml` exists — if not, mention it needs to be created before Stage 5 but don't block the workflow.

## Stages

| # | Stage | Outcome |
|---|-------|---------|
| 1 | **Gather** | Version number and changelog data extracted and confirmed |
| 2 | **Copy** | Post title and body drafted and approved |
| 3 | **Image** | Release card rendered as PNG at `{project-root}/release-cards/release-card-v{VERSION}.png` |
| 4 | **Preview** | User sees copy + image + target subreddits and gives explicit go-ahead |
| 5 | **Publish** | Posted to all configured subreddits, URLs logged |

Load `references/01-gather.md` and follow stages in sequence. Move to the next stage only when the current stage's outcome is met.
