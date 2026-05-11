# Stage 1: Gather Release Data

**Outcome:** Version number confirmed, per-package changes summarized, user says the data is accurate.

Run:

```bash
python3 scripts/gather_release_data.py {project-root}
```

Review the JSON output. Surface to the user:

- The release version (e.g. `0.2.1`)
- What changed, grouped by type (Major / Minor / Patch), deduped across packages
- Any packages that had no changes or parsing errors

If a package was skipped or the version looks wrong, ask the user before proceeding.

Present a clean human-readable summary — not the raw JSON. Ask if there's anything missing or context to add (e.g. a migration note, a shoutout to a contributor, a one-liner about motivation).

**Proceed to Stage 2** once the user confirms the data is good. Carry the version string and aggregated changes forward — they're needed in every subsequent stage.

Then load `references/02-generate-copy.md`.
