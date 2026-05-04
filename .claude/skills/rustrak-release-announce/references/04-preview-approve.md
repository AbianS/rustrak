# Stage 4: Preview & Approve

**Outcome:** The user has seen the post text, the release card image, and the target subreddits — and said yes.

Present everything together:

1. **Post title** (formatted as a Reddit title)
2. **Post body** (rendered markdown)
3. **Release card image** — display inline if the environment supports it; otherwise show the path `{project-root}/release-cards/release-card-v{VERSION}.png` and remind the user to open it
4. **Target subreddits** — read from `{skill-root}/.announce.config.toml`, list them explicitly (e.g. `r/selfhosted`, `r/rust`)

Ask: _"Everything looks good? Confirm to post to these subreddits."_

If the user wants changes:
- Copy tweaks → loop back to Stage 2
- Image tweaks → loop back to Stage 3 (edit the HTML template directly if needed)
- Different subreddits → they edit `.announce.config.toml` directly, then re-confirm

Don't proceed until you have explicit approval.

**Proceed to Stage 5** on explicit yes.

Then load `references/05-publish.md`.
