<div align="center">

![Rustrak: your errors, your infrastructure](../../out/readme-v1/hero.webp)

[![CI](https://github.com/rustrak/rustrak/actions/workflows/ci.yml/badge.svg)](https://github.com/rustrak/rustrak/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/rustrak/rustrak)](https://github.com/rustrak/rustrak/releases)
[![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)
[![Docker pulls](https://img.shields.io/docker/pulls/rustrak/rustrak-server)](https://hub.docker.com/r/rustrak/rustrak-server)

**[Documentation](https://rustrak.github.io/rustrak/)** ·
[Quickstart](#quickstart) ·
[Changelog](https://rustrak.github.io/rustrak/changelog) ·
[Report a bug](https://github.com/rustrak/rustrak/issues)

</div>

Rustrak is a self-hosted error tracker that also takes logs, transactions,
release health and AI-agent traces.

It speaks the Sentry protocol rather than a lookalike of it, so the SDK you
already have points at Rustrak by changing one string. No new agent to install,
no vendor library to swap, no code to rewrite. It runs as a single process
with SQLite by default, which means the whole install is one compose file and
nothing to provision.

![The Rustrak dashboard](../../out/readme-v1/wp-overview.webp)

## Why Rustrak

Error tracking usually comes two ways: a SaaS bill that scales with your worst
day, or a self-hosted stack that wants its own machine. Rustrak is the third
option: the same protocol, on hardware you already have.

Two design decisions do most of that work. **The dashboard is a separate image
from the server**, so you can run the API on a small box and the dashboard on
your laptop or on Vercel; the machine holding your data never serves frontend
assets. And **ingestion is two-phase**. The endpoint parses the envelope, writes
it to disk and returns `200`; a spawned task then does the database work.
Accepting an event never waits on the database, which is what stops a traffic
spike from becoming a timeout inside your app.

![16.5 MB server image, one process, zero external services](../../out/readme-v1/numbers.webp)

No per-event pricing, no sampling you did not ask for, and no seat you have to
justify to anyone.

## Quickstart

SQLite is the default, so this is the whole install. There is no database to
provision and no broker to run.

```yaml
# docker-compose.yml
services:
  server:
    image: rustrak/rustrak-server:latest
    ports: ["8080:8080"]
    volumes: [rustrak_data:/data]
    environment:
      - SESSION_SECRET_KEY=${SESSION_SECRET_KEY}
      - CREATE_SUPERUSER=${CREATE_SUPERUSER}
    restart: unless-stopped

  ui:
    image: rustrak/rustrak-ui:latest
    ports: ["3000:3000"]
    environment:
      - RUSTRAK_API_URL=http://server:8080
    depends_on: [server]
    restart: unless-stopped

volumes:
  rustrak_data:
```

```bash
export SESSION_SECRET_KEY=$(openssl rand -hex 32)
export CREATE_SUPERUSER=admin@example.com:changeme123
docker compose up -d
```

Open <http://localhost:3000> and sign in with those credentials.

Running at scale? Use the `:postgres` tag and set `DATABASE_URL`. The
[installation guide](https://rustrak.github.io/rustrak/getting-started/installation)
has the full compose file and the production notes.

## Point your SDK at it

Rustrak accepts the standard Sentry envelope, so migrating is a configuration
change rather than a project. Create a project, copy its DSN, and change one
line. Your SDK never learns it is talking to something else.

![Change the DSN. Ship.](../../out/readme-v1/dsn.webp)

```python
# Python
import sentry_sdk
sentry_sdk.init(dsn="http://<key>@localhost:8080/<project_id>")
```

```javascript
// JavaScript
import * as Sentry from "@sentry/browser";
Sentry.init({ dsn: "http://<key>@localhost:8080/<project_id>" });
```

```go
// Go
sentry.Init(sentry.ClientOptions{Dsn: "http://<key>@localhost:8080/<project_id>"})
```

Any Sentry SDK works, in any language. If you are already sending to Sentry, you
can point a second DSN at Rustrak and compare the two before committing.

## What's inside

### Errors

Events are grouped into issues by a deterministic fingerprint: the one your SDK
sent if it sent one, otherwise exception type plus the first line of the message
plus the transaction. Same input, same group, every time, so an issue does not
split in two after a deploy.

From the list you can triage in bulk, filter by status, and read each issue's
24-hour trend without opening anything. Upload source maps and a minified frame
resolves back to the line you actually wrote.

![Errors, grouped by fingerprint](../../out/readme-v1/wp-issues.webp)

### AI agent traces

Turn on your SDK's AI integration and agent runs appear on their own page: runs
over time, duration percentiles, top models by calls and by tokens, top tools,
and a per-trace waterfall of every LLM call, tool call and handoff in order.

Rustrak reads Sentry's Spans Protocol v2, the batched format the real SDKs use
for AI spans, verified against `@sentry/node` with the Vercel AI SDK. It also
takes standalone OTel-style spans that have no parent transaction. When one agent
hands off to another mid-run, the trace lists every agent involved, not just the
first.

![Every LLM call, tool call and handoff, in order](../../out/readme-v1/wp-agents.webp)

There is no server-side setup. One integration in `Sentry.init` is the whole
change:

```javascript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: 'http://<key>@localhost:8080/<project_id>',
  integrations: [Sentry.vercelAIIntegration()],
});
```

And there is deliberately **no spend widget**. Per-model pricing goes stale
faster than we could ship it, so Rustrak reports exact token counts and leaves
the multiplication to you.

### Performance

Transactions and spans flow through a processor pipeline onto a performance
dashboard, ranked by p95. Latency is coloured against thresholds rather than left
as raw numbers: green under a second, amber under three, red beyond. The row that
needs attention is the one that looks wrong.

Open a transaction for its span waterfall and its measurements.

![The slow ones, ranked by p95](../../out/readme-v1/wp-performance.webp)

### Logs

Errors tell you what broke. Logs tell you what your app was doing when it did
not. Rustrak stores structured logs as a first-class event type on the same
envelope endpoint, with six severities from `trace` to `fatal`, their own filter,
and per-row attributes that keep their types.

A log emitted inside an active span carries the `trace_id`, so it links back to
the request it came from.

![Logs and errors, same SDK, same place](../../out/readme-v1/wp-logs.webp)

Logging is off by default in Sentry SDKs. Opt in once, then use the logger:

```javascript
Sentry.init({
  dsn: 'http://<key>@localhost:8080/<project_id>',
  enableLogs: true,
});

Sentry.logger.info('User signed up', { userId: 4172, plan: 'pro' });
```

### Release health

Sessions are tracked with full Sentry SDK compatibility and aggregated per
release, which turns "is this deploy worse than the last one" into two numbers:
**crash-free sessions** and **crash-free users**.

Both are tiered rather than printed flat: green at 99% or above, amber at 95%,
red below. A release at 96% is not fine and should not read as if it were.

![Is this deploy worse than the last one?](../../out/readme-v1/wp-releases.webp)

### Alerts

Alert rules fire on three events, and each rule chooses its own destination:

| Trigger | When it fires |
|---|---|
| `new_issue` | A new issue is detected for the first time |
| `regression` | A resolved issue reappears |
| `unmute` | A muted issue is unmuted |

Destinations are Slack (incoming webhook or bot token), SMTP email, or a plain
JSON webhook. Credentials belong to the instance and are configured once;
routing belongs to the rule.

![Configure it once. Route it per rule.](../../out/readme-v1/wp-alerts.webp)

### Teams, storage and retention

Projects carry three roles, **Admin**, **Member** and **Viewer**, with
invitations, so a contractor can be given one project and nothing else.

The server also reports its own storage usage and enforces configurable
retention, with manual cleanup and source-map garbage collection on demand. That
matters more on a self-hosted instance than on a hosted one: nobody else is going
to notice the disk filling up.

### Getting around

`⌘K` opens a command bar over any screen. Projects and settings are two fixed
sections, with the highlighted project's pages in a preview column, so Enter on
a project goes to the project and its pages stay one keystroke away. Typing
flattens everything into one relevance-ordered list.

## From code, and from your editor

The REST API has a typed client, and the client has an MCP server over it, so an
assistant can triage your instance in the same session it is writing the fix.

```bash
npm install @rustrak/client   # the REST API, typed
npx @rustrak/mcp              # Claude, Cursor, Continue
```

| Package | Version | What it is |
|---|---|---|
| [`@rustrak/client`](https://www.npmjs.com/package/@rustrak/client) | [![npm](https://img.shields.io/npm/v/@rustrak/client?style=flat-square)](https://www.npmjs.com/package/@rustrak/client) | TypeScript client. Every method returns `Result<T, RustrakError>` and never throws, so a call that can fail says so in its type |
| [`@rustrak/mcp`](https://www.npmjs.com/package/@rustrak/mcp) | [![npm](https://img.shields.io/npm/v/@rustrak/mcp?style=flat-square)](https://www.npmjs.com/package/@rustrak/mcp) | MCP server over that client, so an assistant can read and manage your instance |

An OpenAPI spec is served at `/docs` and mirrored in the documentation site.

## Documentation

| | |
|---|---|
| [Getting started](https://rustrak.github.io/rustrak/getting-started/overview) | What Rustrak is and how it fits together |
| [Installation](https://rustrak.github.io/rustrak/getting-started/installation) | Self-hosting, PostgreSQL, production notes |
| [Configuration](https://rustrak.github.io/rustrak/configuration/environment) | Every environment variable |
| [API reference](https://rustrak.github.io/rustrak/reference/api) | Endpoints and schemas |
| [Architecture](https://rustrak.github.io/rustrak/reference/architecture) | Two-phase ingestion, grouping, storage |

## Contributing

Contributions are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers the local
setup, the test suite and the quality gate.

## License

GPL-3.0. See [LICENSE](LICENSE). Copyright © 2026 Abian Suarez.
