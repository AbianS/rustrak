---
"@rustrak/client": patch
"@rustrak/mcp": patch
"docs": patch
---

Improve npm package metadata, READMEs, and official documentation.

- Add `homepage`, `repository` (with monorepo `directory`), `bugs`, `author`, and `engines` fields to both packages
- Expand `keywords` for better npm search discoverability
- Add `README.md` to `@rustrak/client` published files (was missing)
- Rewrite both package READMEs: badge row, prominent docs link, cross-references between packages, Cursor and Continue.dev config examples in `@rustrak/mcp`
- Add new "SDKs & Integrations" section to the docs site with dedicated pages for `@rustrak/client` and `@rustrak/mcp` covering installation, full API reference, error handling, and AI client setup
