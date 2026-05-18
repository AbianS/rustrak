---
name: step-01-init-fetch
description: Resolve PR number, fetch metadata, all review threads and general reviews, filter and classify
nextStep: references/step-02-analyze.md
---

# Step 1: Init + Fetch

## GOAL

Resolve the PR, fetch all active review threads and general reviews. No analysis, no verdicts.

## CONSTANTS

- `repo` = `AbianS/rustrak`
- `repo_owner` = `AbianS`
- `repo_name` = `rustrak`

## SEQUENCE

### 1. Resolve PR Number

**If `pr_number` was provided as arg:** use it directly.

**If not:** run `gh pr view --json number` and extract `number` as `pr_number`.

**If it fails:** display `❌ No PR found on current branch. Use: /analyze-pr-feedback 1234` → stop.

### 2. Fetch PR Metadata

```bash
gh pr view {pr_number} --repo AbianS/rustrak --json number,title,headRefName,baseRefName,state,url,reviewDecision,author
```

Store: `pr_title`, `pr_head_branch`, `pr_base_branch`, `pr_state`, `pr_url`, `pr_review_decision`, `pr_author`.

**If `pr_state` = MERGED or CLOSED:** display `⚠️ PR #{pr_number} is {pr_state}. Continue anyway? [Y/N]` → halt. N → stop.

### 3. Fetch Review Threads (GraphQL)

```bash
gh api graphql -f query='
  query($owner: String!, $repo: String!, $pr: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100) {
          nodes {
            id
            isResolved
            isOutdated
            comments(first: 20) {
              nodes {
                id
                body
                path
                line
                startLine
                diffHunk
                createdAt
                author { login }
              }
            }
          }
        }
      }
    }
  }
' -F owner="AbianS" -F repo="rustrak" -F pr={pr_number}
```

Per thread store: `thread_id`, `is_resolved`, `is_outdated`, and per comment: `comment_id`, `author_login`, `body`, `path`, `line`, `diff_hunk`.

### 4. Fetch General Reviews (REST)

```bash
gh api repos/AbianS/rustrak/pulls/{pr_number}/reviews
```

Store reviews with non-empty `body` and state CHANGES_REQUESTED or COMMENTED as `general_reviews` array (fields: `review_id`, `author_login`, `body`, `state`, `submitted_at`).

### 5. Filter and Classify

**Discard** threads where `is_resolved = true`.

Mark `is_bot = true` if `author_login` ends in `[bot]` or is: `github-actions`, `coderabbitai`, `sonarqube`, `codeclimate`, `renovate`, `dependabot`.

Store remaining as `active_threads`. Store filtered general reviews as `active_reviews`.

**If both empty:** display `✅ PR #{pr_number} has no active review comments.` → stop.

### 6. Display and Proceed

Display one line:
```
PR #{pr_number} — {pr_title}
{active_threads.count} inline threads ({bot_count} bots, {human_count} humans) + {active_reviews.count} general reviews. Analyzing...
```

Load and execute `{nextStep}`.
