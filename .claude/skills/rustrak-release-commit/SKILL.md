---
name: rustrak-release-commit
description: Prepara el release commit con changeset y changelog. Use when user says 'prepare release commit' or 'create release version' or 'hacer release'.
---

# rustrak-release-commit

## Overview

Act as release manager for the Rustrak monorepo. This workflow prepares a new version release by: (1) analyzing git history since the last tag to understand what changed, (2) creating a changeset file with appropriate version bumps, and (3) generating a full changelog MDX entry in the docs site. The user reviews and confirms each step — the skill suggests, the user decides.

## Conventions

- Bare paths (e.g. `references/guide.md`) resolve from the skill root.
- `{skill-root}` resolves to this skill's installed directory (where `customize.toml` lives).
- `{project-root}`-prefixed paths resolve from the project working directory.
- `{skill-name}` resolves to the skill directory's basename.

## On Activation

1. Load config from `{project-root}/_bmad/config.yaml` and `{project-root}/_bmad/config.user.yaml` if present. Use sensible defaults for anything not configured.
2. If `--headless` or `-H` flag is present, set `{headless_mode}=true` and skip all user confirmations — use the suggested bump and proceed.
3. Greet the user and confirm intent: "I'll prepare a new release. Let me start by analyzing what's changed since the last version."

## Stage 1: Analyze Git History

1. List all git tags sorted by date (newest first): `git tag --sort=-v:refname`
2. Identify the most recent tag across all packages.
3. Run `git log <latest_tag>..HEAD --format="%H %an <%ae> %s"` and group commits by conventional commit type (feat, fix, docs, chore, refactor, test).
4. For each commit, extract the contributor's GitHub username:
   - For direct commits (non-merge), use the author name if it looks like a GitHub handle or the local part of their email before `@`.
   - For merge commits with format "Merge pull request #N from <user>/<branch>", extract `<user>` as the GitHub username.
   - Skip `github-actions[bot]` — no attribution needed.
   - The repo owner's commits (Abian, AbianS) don't need attribution — only external contributors.
5. Present a summary to the user:
   - Latest tag and date
   - Commit count since then
   - Breakdown by type
   - Notable changes (features, fixes, breaking changes)
6. **Suggest a bump level** based on the analysis:
   - `major` if any commit message contains `BREAKING CHANGE` or `!:` after the type
   - `minor` if there are `feat:` commits
   - `patch` if only `fix:`, `docs:`, `chore:`, `refactor:`, `test:` commits
7. **Interactive:** Ask the user to confirm or override the bump for each package. Present the list of packages that had changes:
   - `@rustrak/server` (apps/server)
   - `webview-ui` (apps/webview-ui)
   - `@rustrak/client` (packages/client)
   - `@rustrak/mcp` (packages/mcp)
   - `docs` (apps/docs) — always `patch` since a changelog entry is created in docs
8. **Headless:** Use the suggested bump for all packages, skip confirmation.

## Stage 2: Create Changeset

1. Generate a random changeset filename (e.g. `shiny-dogs-walk.md` — use a short memorable slug).
2. Create the file at `{project-root}/.changeset/<filename>.md` with format:

   ```markdown
   ---
   "<package-name>": "<bump>"
   ---

   <description of changes>
   ```

   Only include packages that are being bumped (docs is always included as `patch` since a changelog entry is created). The description should be a concise bullet-free summary of what changed, written for the changelog audience. For changes made by external contributors, append `(@github_username)` after the relevant change description.

3. **Interactive:** Show the generated changeset to the user and ask for approval before writing.
4. **Headless:** Write directly without confirmation.

## Stage 3: Create Changelog Entry

1. List existing changelog files in `{project-root}/apps/docs/content/changelog/` to find the next sequential number.
2. Determine the new version string. Read the current version from `{project-root}/apps/server/Cargo.toml` and apply the bump for `@rustrak/server`. For other packages, read their respective `package.json`.
3. Generate a slug from the release title (kebab-case, matching existing convention like `session-tracking`).
4. Create the file at `{project-root}/apps/docs/content/changelog/<NN>-v<version>-<slug>.mdx` with full frontmatter and content:

   ```mdx
   ---
   version: v<version>
   title: <Release Title>
   description: <One-line summary of the release>
   date: <YYYY-MM-DD>
   tags: [<comma-separated tags>]
   ---

   ## <Feature/Change Name>

   <description of the feature>

   - <bullet point>
   - <bullet point>

   ## Improvements

   - <improvement>
   - <improvement>
   ```

   Structure the content based on the actual commits analyzed in Stage 1. Group related changes into sections. Use the same style as existing changelog files. For changes by external contributors, append `([@username](https://github.com/username))` to the relevant bullet point.

5. **Interactive:** Show the generated changelog path and ask for approval.
6. **Headless:** Write directly.

## Finalize

1. Suggest the release commit message. Derive it from the release version and title:
   - Format: `release: v<version> — <Release Title>`
   - Example: `release: v0.8.0 — Logs Ingestion Pipeline`
   - Include the changeset, changelog, and any files modified during the release workflow (including this skill) in the commit.
2. Summarize what was created:
   - Changeset file path
   - Changelog file path
   - Version bumps applied per package
   - Suggested commit message
3. Remind the user of next steps:
   - Review the changeset and changelog
   - Run `pnpm changeset version` to apply versions
   - Run `pnpm run build` to verify
   - Commit with: `git add .changeset/ apps/docs/content/changelog/ .claude/skills/rustrak-release-commit/ && git commit -m "release: v<version> — <Release Title>"`
   - Push
