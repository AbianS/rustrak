---
description: Create a concise git commit
allowed-tools:
  - Bash(git status:*)
  - Bash(git add:*)
  - Bash(git commit:*)
model: haiku
---

# Commit changes

<git_status>
!`git status --short`
</git_status>

<git_diff>
!`git diff --cached`
</git_diff>

Generate a single-line conventional commit message (max 72 chars).

Now run:

!`git commit -m '<the message you decided>'`
