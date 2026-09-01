---
"@rustrak/server": patch
---

The server now validates `SESSION_SECRET_KEY` before it opens the database. A
secret shorter than the 64 bytes the cookie key needs used to panic deep in
startup, after migrations had run and the workers were up; it now stops the
process immediately with a message naming the length it received and the
command that produces a valid one. `SecurityConfig` also carries a hand-written
`Debug` so the secret cannot reach a log line.

Alongside it, five fixes in the dashboard and the design system: webhook and
Slack URLs are parsed rather than prefix-matched, so `https://` alone no longer
saves; Enter and Space on a waterfall collapse chevron expand the span instead
of selecting the row; a span whose reported end precedes the view window no
longer draws a negative-width bar; the toast progress value is normalized once,
so a caller reporting past the maximum no longer announces a number the bar
contradicts; and the data-table column header gives press feedback again.

Biome now enforces a cognitive complexity limit across the workspace, and the
28 violations were cleared by extracting the logic they held into tested
modules. CI, CodeQL, cargo-deny and CodeRabbit run on pull requests to any base
branch, not only `main`.
