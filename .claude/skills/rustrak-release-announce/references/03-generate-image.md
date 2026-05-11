# Stage 3: Generate Release Card Image

**Outcome:** `{project-root}/release-cards/release-card-v{VERSION}.png` — a 1200×630 PNG ready for sharing.

Run:

```bash
uv run scripts/render_release_card.py \
  --version {VERSION} \
  --output {project-root}/release-cards/release-card-v{VERSION}.png \
  --skill-root {skill-root} \
  --verbose
```

The script uses Playwright + Chromium to render the HTML template (`assets/release-card.html`). `uv` installs Playwright automatically. Chromium (~150MB) is downloaded on first run only.

Parse the JSON output. If `status` is `fail`, surface the error to the user before proceeding.

**Proceed to Stage 4** once the PNG exists at the expected path.

Then load `references/04-preview-approve.md`.
