# Stage 5: Publish

**Outcome:** The announcement is live on all configured subreddits, with URLs logged.

**Step 1 — Verify config**

Check that `{skill-root}/.announce.config.toml` exists and has credentials filled in (`client_id`, `client_secret`, `refresh_token` are non-empty). If missing or incomplete, guide the user to `references/reddit-setup.md` before proceeding.

**Step 2 — Write body to file**

Write the approved post body to `/tmp/rustrak-post-body.md` (avoids shell quoting issues).

**Step 3 — Post**

```bash
uv run scripts/post_to_reddit.py \
  --config {skill-root}/.announce.config.toml \
  --title "APPROVED_TITLE" \
  --body-file /tmp/rustrak-post-body.md
```

Replace `APPROVED_TITLE` with the approved title from Stage 2.

**Step 4 — Report results**

Parse the JSON output and tell the user:
- Which subreddits succeeded and their live URLs
- Which failed and why

If any failed, diagnose the error (auth issue? banned from subreddit? rate limit?) and offer to retry.

Clean up `/tmp/rustrak-post-body.md` when done.

**Workflow complete** when at least one post is live.
