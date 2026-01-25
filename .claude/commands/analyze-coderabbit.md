---
description: Analyze CodeRabbit feedback and fix legitimate issues
allowed-tools:
  - Bash(gh:*)
  - Bash(git:*)
model: opus
---

# Critical CodeRabbit Review Analysis

## Step 1: Fetch PR review comments

<pr_comments>
!`gh pr view $ARGUMENTS --json comments --jq '.comments[] | "\(.author.login): \(.body)"'`
</pr_comments>

## Step 2: Get the diff for context

<pr_diff>
!`gh pr diff $ARGUMENTS`
</pr_diff>

## Step 3: Evaluate and fix

For each CodeRabbit comment:
1. **Assess validity**: Is this a real issue or false positive?
   - Check the actual code context
   - Consider the intent and surrounding patterns
   - Look for legitimate security/performance/correctness problems
   
2. **Provide reasoning**: Explain briefly why you think it's valid or not

3. **Fix only valid issues**: Implement only the ones that are genuinely problematic

4. **Commit with reasoning**: Include why you're accepting/rejecting each comment

Do NOT accept comments blindly. Be critical and provide clear justification.
