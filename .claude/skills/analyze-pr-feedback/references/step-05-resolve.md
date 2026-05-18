---
name: step-05-resolve
description: Confirm, resolve all GitHub threads (fixed → resolve, FP → reply + resolve), print final summary
---

# Step 5: Resolve + Summary

## GOAL

Resolve every active thread on GitHub. Fixed → mark resolved. FP/skipped → reply with explanation then resolve. Inline final summary.

## CONSTRAINTS

- NEVER call the GitHub API without user confirmation
- NEVER resolve threads that had `is_resolved = true` at fetch time
- No git commands in this step

## SEQUENCE

### 1. Show Plan and Confirm

```
Resolution plan — {total_active_threads} threads:

  🔴 Resolve (fixed):              {count_fix_applied}
  🟡 Reply + resolve (FP):         {count_fp}
  ⏭️  Reply + resolve (skipped):    {count_skipped}

Proceed? [Y/N]
```

Halt. N → stop.

### 2. Resolve Fixed Threads

For each thread in `approved_fixes` where `fix_applied = true`:

```bash
gh api graphql -f query='
  mutation($threadId: ID!) {
    resolveReviewThread(input: {threadId: $threadId}) {
      thread { isResolved }
    }
  }
' -F threadId="{thread_id}"
```

On error: store in `resolve_errors`, continue.

### 3. Reply + Resolve FP Threads

For each thread where `verdict = FALSE_POSITIVE`:

**a. Post reply:**
```bash
gh api repos/{repo_owner}/{repo_name}/pulls/{pr_number}/comments \
  --method POST \
  --input - << 'BODY'
{
  "body": "> {first 60 chars of comment_claim}...\n\nReviewed: {fp_explanation}. No changes needed.",
  "in_reply_to": {comment_id}
}
BODY
```

**b. Resolve thread** (same GraphQL mutation as step 2).

On error: store in `resolve_errors`, continue.

### 4. Reply + Resolve Skipped Threads

For each thread in `skipped_fixes`:

Reply: `Reviewed. The proposed fix requires broader changes ({skip_reason}). Will be addressed in a separate commit.`

Then resolve via GraphQL.

### 5. Reply to General Reviews

**If `active_reviews` is non-empty:** post a single consolidated response:

```bash
gh api repos/{repo_owner}/{repo_name}/pulls/{pr_number}/reviews \
  --method POST \
  -f body="All comments in this review have been analyzed and processed. See recent commits." \
  -f event="COMMENT"
```

### 6. Final Summary

```
✅ PR #{pr_number} — {pr_title}
{pr_url}

Comments:  {total_analyzed} analyzed · {count_real} real · {count_fp} FP
Fixes:     {count_fix_applied} applied{if skipped: " · {count} skipped"}
{if commit_sha: "Commit:    {commit_sha} → {pr_head_branch}"}
Resolved:  {count_resolved} threads
{if resolve_errors: "⚠️  API errors: {count} — resolve manually at {pr_url}"}
```

End of workflow.
