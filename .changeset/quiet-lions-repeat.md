---
"@rustrak/server": "minor"
---

`@rustrak/client` no longer throws. Every resource method returns `Result<T, RustrakError>`, a plain discriminated union that survives `structuredClone` and therefore React's server/client boundary, and the nine error classes collapse into one union keyed on `kind`. 5xx bodies are redacted inside the client, so no consumer can leak a server message by accident. Breaking for anyone calling the client directly.

The server now names the offending field as data: `ErrorDetail` carries an optional `fields` array of `{field, code, message?}` on both 400 and 409, so a form can mark the input that was rejected instead of matching English prose.

The dashboard gains a command bar built on cmdk, with a project preview column and word-boundary scoring (@bobbymannino), and real failure screens: a full-viewport `ErrorScreen` for the routes with no chrome, plus the app's first custom 404.

Internally `webview-ui` is now sliced by domain with a portable core, and both apps sit behind the CI quality gate.
