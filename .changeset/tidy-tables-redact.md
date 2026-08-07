---
"@rustrak/server": "patch"
---

Every list in the dashboard drew its own table. A shared DataTable on TanStack
Table v9 now backs issues, logs, tokens, alert rules, project members and team
members, so a header and its cells read one column declaration instead of a
hand-applied width map that had already drifted apart once. Batch actions move
inside the header row rather than pushing the table down, and a clickable row
is a real tab stop with Enter, Space and a focus ring.

A 5xx no longer puts the error's own `Display` on the wire. `AppError::Database`
rendered the constraint, table and column of the failed query, and
`AppError::Internal` interpolated whatever internal text its call site had to
hand; both are replaced by a fixed message, and the detail goes to a log line
keyed by an incident id carried in the body and in the `X-Rustrak-Incident`
header. `@rustrak/client` surfaces it as `incidentId` on `server_error`, omitted
entirely when the response carries none.

The MCP handshake advertised a hardcoded `0.1.0` while the package was at
0.14.1. It now derives the version from `package.json`, which the fixed group
already bumps on every release.

Dependencies updated to their latest exact versions across the monorepo.
