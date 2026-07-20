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
6. **Suggest a single bump level** for the release based on the analysis:
   - `minor` if any commit message contains `BREAKING CHANGE` or `!:` after the type, or if there are `feat:` commits
   - `patch` if only `fix:`, `docs:`, `chore:`, `refactor:`, `test:` commits
   - Never suggest `major` while the product is on `0.x`. See "Versioning Policy" below.
7. **Interactive:** Ask the user to confirm or override the single release bump. Do not ask per package, the fixed group makes that irrelevant.
8. **Headless:** Use the suggested bump, skip confirmation.

### Versioning Policy

Rustrak uses **lockstep versioning**: `@rustrak/server`, `webview-ui`, `@rustrak/client`, `@rustrak/mcp` and `docs` are declared as a `fixed` group in `.changeset/config.json`. They always share one version number and are bumped together even when a given package has no changes.

Consequences for this workflow:

- One changeset naming one package bumps all five. There is no per-package bump decision.
- The group takes the **highest** bump present, so a `major` anywhere drags the whole product to the next major.
- **While on `0.x`, never write a `major` changeset.** Use `minor` to signal a breaking change, per the standard 0.x convention. A `major` would push the product to 1.0.0 as a side effect.
- The version number identifies the Rustrak release, not the semver of an individual artifact. The changelog is what tells users which part actually changed.

## Stage 2: Create Changeset

1. Generate a random changeset filename (e.g. `shiny-dogs-walk.md` — use a short memorable slug).
2. Create the file at `{project-root}/.changeset/<filename>.md` with format:

   ```markdown
   ---
   "<package-name>": "<bump>"
   ---

   <description of changes>
   ```

   Name only `"@rustrak/server"` with the agreed bump. The fixed group propagates it to `webview-ui`, `@rustrak/client`, `@rustrak/mcp` and `docs` automatically, so listing them is redundant and risks a mismatched bump level. The description should be a concise bullet-free summary of what changed, written for the changelog audience. For changes made by external contributors, append `(@github_username)` after the relevant change description.

3. **Interactive:** Show the generated changeset to the user and ask for approval before writing.
4. **Headless:** Write directly without confirmation.

## Stage 3: Create Changelog Entry

1. List existing changelog files in `{project-root}/apps/docs/content/changelog/` to find the next sequential number.
2. Determine the new version string. Read the current version from `{project-root}/apps/server/Cargo.toml` and apply the agreed bump. Because of the fixed group this is the version for every package in the release, so there is nothing to compute per package.
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
   - Format: `release: v<version> - <Release Title>`
   - Example: `release: v0.8.0 - Logs Ingestion Pipeline`
   - Include the changeset, changelog, and any files modified during the release workflow (including this skill) in the commit.

   The changelog MDX from Stage 3 is not just docs: `.github/workflows/release.yml` reads it to build the GitHub release body, matching on the `<NN>-v<version-with-dashes>-<slug>.mdx` filename and stripping the frontmatter. Keep that naming exact, and keep the `title:` field meaningful since it becomes the release title (`Rustrak v0.12.0: <title>`). If no entry matches, the workflow falls back to the generated `apps/server/CHANGELOG.md` section.
2. Summarize what was created:
   - Changeset file path
   - Changelog file path
   - The single version the whole fixed group moves to
   - Suggested commit message
3. Remind the user of next steps:
   - Review the changeset and changelog
   - Run `pnpm changeset version` to apply versions
   - Run `pnpm run build` to verify
   - Commit with: `git add .changeset/ apps/docs/content/changelog/ .claude/skills/rustrak-release-commit/ && git commit -m "release: v<version> — <Release Title>"`
   - Push
