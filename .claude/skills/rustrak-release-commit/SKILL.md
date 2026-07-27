---
name: rustrak-release-commit
description: Prepara el release commit con changeset y changelog. Use when user says 'prepare release commit' or 'create release version' or 'hacer release'.
---

# rustrak-release-commit

## Overview

Act as release manager for the Rustrak monorepo. This workflow prepares a new version release by: (1) analyzing git history since the last tag to understand what changed, (2) creating a changeset file with appropriate version bumps, and (3) generating a full changelog MDX entry in the docs site. The user reviews and confirms each step — the skill suggests, the user decides.

Not every cycle ends in a release. Since `docs` left the fixed group, a run can find that only the docs site changed, and then the right outcome is a `docs` bump and no product release at all. Stage 1 classifies this before anything else, because the rest of the workflow reads very differently depending on the answer.

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
5. **Classify the cycle before suggesting any bump.** Run `git diff --name-only <latest_tag>..HEAD | grep -v '^apps/docs/'` and look at what is left:
   - **Product cycle**: anything under `apps/server/`, `apps/webview-ui/`, `packages/client/`, `packages/mcp/`, or the root build/CI files changed. Run every stage below as written.
   - **Docs-only cycle**: nothing is left but `pnpm-lock.yaml`, and that churn traces to `apps/docs` dependencies. There is no product release to cut. Follow "Docs-only cycle" under the Versioning Policy and skip the product bump entirely.
   - **Nothing changed**: say so and stop.

   On a docs-only cycle, do **not** ask the user which product bump they want. Nothing in the fixed group changed, so there is no bump to choose; offering the choice is how an empty product release gets cut by accident. Report the classification as a fact, then move to the `docs` decision in step 9.
6. Present a summary to the user:
   - Latest tag and date
   - Commit count since then
   - Breakdown by type
   - Notable changes (features, fixes, breaking changes)
   - The cycle classification from step 5, stated plainly
7. **Product cycles only. Suggest a single bump level** for the release based on the analysis:
   - `minor` if any commit message contains `BREAKING CHANGE` or `!:` after the type, or if there are `feat:` commits
   - `patch` if only `fix:`, `docs:`, `chore:`, `refactor:`, `test:` commits
   - Never suggest `major` while the product is on `0.x`. See "Versioning Policy" below.
8. **Interactive, product cycles only:** Ask the user to confirm or override the single release bump. Do not ask per package for the fixed group, it makes that irrelevant, but see the separate `docs` decision in step 9.
9. Decide whether the **`docs` package** also bumps. It is versioned independently (see "Versioning Policy"), so this is a second, separate decision:
   - Check whether the commits touched `apps/docs/`, ignoring `apps/docs/content/changelog/` (this workflow writes that itself in Stage 3, so it never justifies a bump on its own).
   - If nothing else under `apps/docs/` changed, **do not bump `docs`** and do not write a `docs` changeset. Say so explicitly rather than silently skipping it.
   - If the docs site itself changed, suggest a `patch` (or `minor` for a redesign or a restructure of the information architecture) and ask the user to confirm.
   - **Headless:** default to no `docs` bump unless `apps/docs/` changed outside `content/changelog/`, in which case use `patch`.
10. **Headless:** Use the suggested product bump, skip confirmation. On a docs-only cycle there is no product bump to use.

### Versioning Policy

**Shipped artifacts are lockstep.** `@rustrak/server`, `webview-ui`, `@rustrak/client` and `@rustrak/mcp` are declared as a `fixed` group in `.changeset/config.json`. They always share one version number and are bumped together even when a given package has no changes.

Consequences for this workflow:

- One changeset naming one of them bumps all four. There is no per-package bump decision inside the group.
- The group takes the **highest** bump present, so a `major` anywhere drags the whole product to the next major.
- **While on `0.x`, never write a `major` changeset.** Use `minor` to signal a breaking change, per the standard 0.x convention. A `major` would push the product to 1.0.0 as a side effect.
- The version number identifies the Rustrak release, not the semver of an individual artifact. The changelog is what tells users which part actually changed.

**`docs` is versioned independently.** It sits outside the `fixed` group and bumps only when a changeset names `docs` explicitly.

- Its version **will** fall behind the product version. That is expected, not drift to be corrected. Never "resync" it, and never add `apps/docs` back to the fixed-group alignment loop in `.github/workflows/release.yml`.
- Nothing reads that version: `docs` is `private` and never published, and the site builds its version switcher from the frontmatter of `apps/docs/content/changelog/*.mdx` via `scripts/generate-versions.mjs`, not from `package.json`.
- The changelog MDX files are still **product** changelogs, keyed to the product version. A `docs` bump never gets its own changelog entry and never appears in a GitHub release.
- The deploy follows the same rule as the version. `deploy-docs.yml` publishes the site when the version in `apps/docs/package.json` changes on `main`, which happens exactly when a version PR carrying a `docs` changeset merges. It also runs on `release: published`, so a new changelog entry reaches the site with a product release, and on `workflow_dispatch` for a manual republish. So a `docs` changeset is what ships the site: writing one is the whole action, not bookkeeping on the side of one.
- It deliberately does **not** deploy on every push to `main`. Publishing is tied to a version the user chose to cut, which is the point of `docs` having a version at all.

### Docs-only cycle

Every commit since the last tag touched `apps/docs/` and nothing else. This is a normal, expected state now that `docs` is outside the fixed group. Handle it like this:

- Write **only** the `docs` changeset. No `@rustrak/server` changeset: an empty bump would tag a server image identical to the one before it, which makes the tag a lie about what the image contains.
- **Skip Stage 3 entirely.** Changelog MDX files are keyed to a product version and feed the GitHub release body, so with no product release there is nothing to key an entry to and nothing to feed.
- The commit message is a plain conventional commit describing the docs work, not `release: v<version> - <Title>`. No product release is being cut.
- The `docs` changeset is what publishes the site. Merging the version PR moves `apps/docs/package.json`, and `deploy-docs.yml` deploys on that. Say so when reporting, since "no release" otherwise reads as "nothing ships".
- Never suggest a product `patch` to force a deploy. It spends a version number on nothing and tags a server image identical to the one before it. The docs deploy has its own path; this is what it is for.

## Stage 2: Create Changeset

On a **docs-only cycle**, skip steps 1 and 2: there is no product changeset. Go straight to step 3 and write the `docs` changeset alone.

1. Generate a random changeset filename (e.g. `shiny-dogs-walk.md` — use a short memorable slug).
2. Create the file at `{project-root}/.changeset/<filename>.md` with format:

   ```markdown
   ---
   "<package-name>": "<bump>"
   ---

   <description of changes>
   ```

   Name only `"@rustrak/server"` with the agreed bump. The fixed group propagates it to `webview-ui`, `@rustrak/client` and `@rustrak/mcp` automatically, so listing them is redundant and risks a mismatched bump level.

   Do **not** name `docs` here. It is outside the fixed group, so adding it to this changeset would bump it as a side effect of a product release, which is exactly what independent versioning is meant to avoid.

   The description should be a concise bullet-free summary of what changed, written for the changelog audience. For changes made by external contributors, append `(@github_username)` after the relevant change description.

3. If step 9 of Stage 1 decided the docs site also bumps, write a changeset file naming only `"docs"`, with its own short description of what changed in the docs site. On a product cycle this is a **second, separate** file: one changeset naming both packages would couple bumps that must stay independent. On a docs-only cycle it is the only changeset written.
4. **Interactive:** Show the generated changeset(s) to the user and ask for approval before writing.
5. **Headless:** Write directly without confirmation.

## Stage 3: Create Changelog Entry

**Product cycles only.** On a docs-only cycle skip this stage: the entry is keyed to a product version that is not moving, and its only consumers are the GitHub release body and the version switcher, neither of which gets a new entry here. Go to Finalize.

1. List existing changelog files in `{project-root}/apps/docs/content/changelog/` to find the next sequential number.
2. Determine the new version string. Read the current version from `{project-root}/apps/server/Cargo.toml` and apply the agreed bump. Because of the fixed group this is the version for every shipped artifact in the release, so there is nothing to compute per package. Ignore the `docs` package version here, it is independent and is never what the changelog entry is keyed to.
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

On a **docs-only cycle**, Finalize is shorter. Suggest a plain conventional commit for the docs work and the `docs` changeset (`docs: <what changed>`), and skip the version-and-title machinery below along with everything about the changelog entry. Report that no product release is being cut, that `docs` moves on its own, and that merging the version PR is what deploys the site through `deploy-docs.yml`. Next steps are: push, merge the version PR that changesets opens, and the deploy follows.

1. Suggest the release commit message. Derive it from the release version and title:
   - Format: `release: v<version> - <Release Title>`
   - Example: `release: v0.8.0 - Logs Ingestion Pipeline`
   - Include the changeset, changelog, and any files modified during the release workflow (including this skill) in the commit.

   The changelog MDX from Stage 3 is not just docs: `.github/workflows/release.yml` reads it to build the GitHub release body, matching on the `<NN>-v<version-with-dashes>-<slug>.mdx` filename and stripping the frontmatter. Keep that naming exact, and keep the `title:` field meaningful since it becomes the release title (`Rustrak v0.12.0: <title>`). If no entry matches, the workflow falls back to the generated `apps/server/CHANGELOG.md` section.
2. Summarize what was created:
   - Changeset file path(s): the product changeset, and the `docs` changeset if one was written
   - Changelog file path
   - The single version the whole fixed group moves to
   - Whether `docs` bumps in this release, and to what. If it does not, say so and note that its version staying behind is expected.
   - Suggested commit message
3. Remind the user of next steps:
   - Review the changeset and changelog
   - Run `pnpm changeset version` to apply versions
   - Run `pnpm run build` to verify
   - Commit with: `git add .changeset/ apps/docs/content/changelog/ .claude/skills/rustrak-release-commit/ && git commit -m "release: v<version> - <Release Title>"`
   - Push
