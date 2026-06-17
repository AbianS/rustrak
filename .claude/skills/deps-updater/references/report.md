# Report

Produce a summary of the entire dependency update run. Tailor presentation to the mode. Produce user-facing content in `{communication_language}`.

## Headless

Emit JSON:

```json
{
  "status": "complete|blocked",
  "date": "2026-06-16T12:00:00Z",
  "scope": {
    "workspaces": ["apps/webview-ui"],
    "packages": ["next", "react"],
    "skipped": []
  },
  "workspaces_affected": 5,
  "updated_packages": [
    { "name": "react", "from": "19.2.6", "to": "20.0.0", "workspaces": ["apps/webview-ui", "apps/docs"] }
  ],
  "codemods_run": [
    { "package": "next", "codemod": "npx @next/codemod@latest ...", "status": "success|failed|skipped" }
  ],
  "breaking_changes": [
    { "package": "next", "from": "16.2.6", "to": "17.0.0", "resolution": "approved|reverted|skipped" }
  ],
  "verification": {
    "typecheck": "passed|failed",
    "lint": "passed|failed",
    "build": "passed|failed",
    "test": "passed|failed"
  },
  "unresolved_issues": []
}
```

## Interactive

Present a Markdown summary in `{communication_language}` with:
- **Summary table** — workspace, deps updated, codemods, verification status
- **Breaking changes** — what was approved, reverted, or deferred
- **Codemods** — what ran and whether they succeeded
- **Verification results** — command by command
- **Next steps** — any unresolved issues or manual migration steps the user needs to handle

End with: "Are you satisfied with this update? (y/n)". If no, offer to roll back specific packages or revert the entire batch.