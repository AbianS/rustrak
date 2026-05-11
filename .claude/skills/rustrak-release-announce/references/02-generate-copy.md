# Stage 2: Generate Announcement Copy

**Outcome:** A Reddit post title and body the user has approved — developer-friendly, no marketing fluff.

Using the release data from Stage 1, draft:

1. **Title** — Short and specific. Include the version. Lead with the most interesting change if there is one.
   - Good: `Rustrak v0.2.1 — SQLite as default, dependency upgrades`
   - Bad: `Rustrak v0.2.1 is out! 🎉`

2. **Body** — Markdown, optimized for Reddit. Structure:
   - One-line project description (for people who don't know Rustrak)
   - What's new, grouped by impact (breaking changes first and flagged clearly)
   - Link to GitHub release / CHANGELOG
   - Optional: link to docs, Docker image, or self-hosting guide

Keep it scannable. Real sentences, not bullet soup. No "I'm excited to announce", no "Please let me know your thoughts", no emojis unless they genuinely aid scannability.

Present one draft. Let the user iterate — they may want a different tone, more/less detail, or a specific phrasing for a technical change.

**Proceed to Stage 3** when the user approves the title and body. Save both — they'll be used in Stages 4 and 5.

Then load `references/03-generate-image.md`.
