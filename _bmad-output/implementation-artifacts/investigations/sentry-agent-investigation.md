# Investigation: Sentry Agent — BMad Format + Ecosystem Research

**Slug:** sentry-agent-investigation
**Status:** Concluded
**Confidence:** High
**Date:** 2026-05-22

---

## Hand-off Brief

The new BMad agent format (2025+) has replaced YAML agent files with a SKILL.md–centric architecture in two flavors: Stateless (full identity inline) and Memory (lean bootloader + sanctum). Don Dinámico's `.agent.yaml` format is legacy. For the Sentry agent, **Stateless with a sidecar** is the right shape: uses the new SKILL.md stateless template, emits `customize.toml`, and exposes `persistent_facts` pointing to sidecar files that accumulate Sentry/Rustrak knowledge. The Sentry ecosystem provides three high-value locally-cloneable resources: `getsentry/relay` (Rust, the protocol ground truth), `getsentry/sentry-data-schemas` (JSON schemas, small), and `getsentry/sentry-javascript` (what SDKs actually send). Official machine-readable specs at `develop.sentry.dev` fill gaps the repo can't. A `sentry-protocol-drift` skill already exists in this project — the new agent must be complementary, not duplicative.

---

## Investigation 1: BMad Agent Format Evolution

### Finding 1-A (Confirmed): Don Dinámico's format is legacy

Don Dinámico uses `_bmad/agents/{name}/{name}.agent.yaml` with sections: `agent.metadata`, `agent.persona`, `agent.critical_actions`, `agent.prompts`, `agent.menu`. The SKILL.md is a one-liner that loads this YAML.

**Evidence:** `conta-pro/_bmad/agents/don-dinamico/don-dinamico.agent.yaml`

The current BMad installation in `feat-sentry-agent` has **zero** `.agent.yaml` files anywhere in `_bmad/agents/`. The directory doesn't even exist.

**Evidence:** `find feat-sentry-agent/_bmad -name "*.agent.yaml"` → 0 results.

### Finding 1-B (Confirmed): New format has three agent archetypes

The `bmad-agent-builder` skill defines them:

| Archetype | SKILL.md shape | Memory | Key files |
|---|---|---|---|
| **Stateless** | Full identity inline | None | SKILL.md + customize.toml + references/ |
| **Memory** | Lean bootloader (~30 lines) | Sanctum folder | + PERSONA/CREED/BOND/MEMORY/CAPABILITIES templates + first-breath.md + init-sanctum.py |
| **Autonomous** | Memory + PULSE enabled | Sanctum + PULSE | + PULSE-template.md |

Source: `bmad-agent-builder/references/agent-type-guidance.md`, `build-process.md`

### Finding 1-C (Confirmed): `customize.toml` replaces agent YAML for metadata

Every agent now ships a `customize.toml` with `[agent]` metadata block. The installer reads it to build the agent roster in `config.toml`'s `[agents.<code>]` sections.

Fields: `code`, `name`, `title`, `icon`, `description`, `agent_type` (stateless|memory|autonomous).

Override files: `_bmad/custom/{skill-name}.toml` (team) and `.user.toml` (personal).

Source: `bmad-agent-builder/assets/customize-template.toml`

### Finding 1-D (Confirmed): Existing per-agent customize YAMLs are for a different purpose

The `_bmad/_config/agents/*.customize.yaml` files (e.g. `bmm-analyst.customize.yaml`) are NOT the new agent format — they're thin override surfaces for the **existing BMad module agents** (Mary, Winston, Amelia, etc.) that live inside the BMad installation itself. They expose: `agent.metadata.name`, `persona`, `critical_actions`, `memories`, `menu`, `prompts`. This is the legacy YAML customize format that `_config/` uses to let users override built-in agents.

**For new custom agents built with `bmad-agent-builder`: the pattern is SKILL.md + customize.toml.** Do not follow the `_config/agents/` YAML structure.

### Finding 1-E (Confirmed): `sentry-protocol-drift` already exists in this project

Path: `.claude/skills/sentry-protocol-drift/SKILL.md`

This is a **stateless workflow** (not an agent) that:
- Monitors Relay releases for protocol changes
- Classifies impact (HIGH/MEDIUM/LOW)
- Scans Rustrak codebase for gaps
- Writes dated drift reports to `docs/sentry-compat/`

The new Sentry agent is complementary: protocol-drift does **automated monitoring**, the Sentry agent does **interactive deep investigation**. They must not duplicate each other.

### Recommendation: Architecture for the Sentry agent

**Shape: Stateless Agent** using `bmad-agent-builder`'s stateless template.

Why not Memory Agent:
- Memory agents are for long-term relationships that evolve (coach, companion). The Sentry agent is a domain expert tool — each session is focused.
- Memory agent overhead (First Breath, sanctum, session logs) adds complexity without payoff here.

Why Stateless with sidecar (like Don Dinámico):
- `customize.toml` exposes `persistent_facts` pointing to sidecar files under `_bmad/memory/agent-sentry-expert/` (or similar).
- Sidecar files accumulate over time: known Rustrak gaps, Relay object map, anti-hallucination rules.
- This achieves Don Dinámico's "memory across sessions" without the full memory-agent machinery.
- The stateless template puts full identity, principles, and capabilities routing in one SKILL.md.

**Key structural difference from Don Dinámico:**

| Don Dinámico (old) | Sentry Agent (new) |
|---|---|
| `SKILL.md` → loads `.agent.yaml` | `SKILL.md` is the full agent |
| `.agent.yaml` has persona + prompts + menu | `SKILL.md` has identity + routing table |
| `prompts` inline in YAML | `references/{capability}.md` files |
| `critical_actions` in YAML | `On Activation` section in SKILL.md |
| No `customize.toml` | `customize.toml` with `[agent]` metadata + persistent_facts pointing to sidecar |

---

## Investigation 2: Sentry Ecosystem Resources

### Finding 2-A (Confirmed): The protocol ground truth is `getsentry/relay`

Relay is Sentry's Rust ingestion layer. Everything that enters Sentry passes through Relay. For Rustrak (also Rust), this is the single most important reference.

**Workspace crates relevant to protocol:**

| Crate | Purpose |
|---|---|
| `relay-protocol` | Protocol definitions and derive macros |
| `relay-event-schema` | Rust structs for every event field: `Event`, `Exception`, `Frame`, `Replay`, `Tags`, `UserReport`, etc. |
| `relay-base-schema` | Base types used across services |
| `relay-event-normalization` | How Relay normalizes incoming events before storage |
| `relay-filter` | Event filtering logic |
| `relay-server` | The actual envelope processing pipeline |
| `relay-test` | Test utilities and fixtures |

**Key for grep-based investigation:**
- All envelope item types defined as Rust enums → grep `relay-event-schema`
- Exact normalization behavior → grep `relay-event-normalization`
- Integration tests with real envelope fixtures → `tests/` directory

**Clone command (sparse — just protocol + schema crates, ~150MB vs full ~800MB):**
```bash
git clone --filter=blob:none --sparse https://github.com/getsentry/relay ~/.sentry-expert/relay-repo/
cd ~/.sentry-expert/relay-repo/
git sparse-checkout set relay-protocol relay-event-schema relay-base-schema relay-event-normalization relay-server/src tests
```

Source: https://github.com/getsentry/relay, https://getsentry.github.io/relay/

### Finding 2-B (Confirmed): `getsentry/sentry-data-schemas` is small and machine-readable

Contains `relay/event.schema.json` — the canonical draft-07 JSON Schema for Sentry error events as Relay accepts them. Auto-synced from Relay master. Also includes `py/` and `seer/` schemas.

**Covers:** All error event fields, required vs optional, types, constraints. Excludes: security reports, transaction events, fields Sentry adds post-ingestion (`metadata`, `title`, `project_id`, `received`).

**Size:** Tiny repo, full clone is fine (~5MB).

```bash
git clone https://github.com/getsentry/sentry-data-schemas ~/.sentry-expert/sentry-data-schemas/
```

Source: https://github.com/getsentry/sentry-data-schemas

### Finding 2-C (Confirmed): `develop.sentry.dev` has machine-readable protocol specs

| Page | What it covers |
|---|---|
| `/sdk/foundations/transport/envelopes/` | Full envelope grammar, headers, parsing rules, size limits |
| `/sdk/foundations/transport/envelope-items/` | All item types: event, transaction, attachment, check_in, spans, logs, metrics, sessions, replays, client_reports |
| `/sdk/foundations/data-model/event-payloads/` | All top-level fields + all interfaces (Exception, Stacktrace, User, Breadcrumbs, Request, Contexts, Threads, etc.) |
| `/sdk/telemetry/spans/span-protocol/` | Span/trace protocol |
| `/sdk/telemetry/logs/` | Log envelope items |
| `/backend/application-domains/grouping/` | Grouping algorithm, fingerprinting, multiple hash generation, AI grouping |
| `/backend/issue-platform/writing-detectors/` | Issue detection logic |

These pages are fetchable at runtime — the agent doesn't need them pre-cloned.

Source: https://develop.sentry.dev/sdk/

### Finding 2-D (Confirmed): Envelope format key facts for Rustrak

From live spec:

- Endpoint: `POST /api/<project_id>/envelope/`
- Content-Type: `application/x-sentry-envelope`
- Grammar: `Envelope = Headers "\n" { Item "\n" }` — each item is `Headers "\n" Payload`
- Headers: single-line JSON, required `type` field per item
- Auth: HTTP header OR `dsn` field in envelope headers (Relay v21.6.0+)
- Size limits: 200MiB envelope, 1MiB per event/span/log/metric item
- Item types: `event`, `transaction`, `attachment`, `check_in`, `spans`, `logs`, `metrics`, `sessions`, `client_report`, `replay_event`, `replay_recording`, `user_report`
- Reserved (internal only): `security`, `unreal_report`, `form_data`

### Finding 2-E (Confirmed): Additional high-value repos

| Repo | Why useful | Size |
|---|---|---|
| `getsentry/sentry-javascript` | TypeScript SDK — what JS apps actually send, envelope building code, test fixtures | Medium |
| `getsentry/sentry-python` | Python SDK — same, plus the `sentry_sdk.envelope` module shows exact serialization | Medium |
| `getsentry/ingest-load-tester` | Load testing tool with **real envelope payloads** as test fixtures | Small |
| `getsentry/sentry` (sparse) | Python/Django — grouping algorithm implementation, issue creation logic | Huge, sparse only |

**Most valuable sparse paths in `getsentry/sentry`:**
```
src/sentry/grouping/
src/sentry/event_manager.py
src/sentry/ingest/
tests/sentry/grouping/
```

### Finding 2-F (Deduced): The agent's "real data" equivalent is test fixtures

Don Dinámico's killer feature was querying live SQL databases. The Sentry agent's equivalent is:
1. **relay test fixtures** — real envelopes in `relay/tests/` that Relay uses to validate itself
2. **SDK test payloads** — in `sentry-python/tests/`, `sentry-javascript/packages/*/test/`
3. **ingest-load-tester payloads** — production-realistic envelopes

These provide concrete examples of what valid (and invalid) Sentry payloads look like.

---

## Evidence Inventory

| Source | Type | Status |
|---|---|---|
| `bmad-agent-builder/references/build-process.md` | Local file | Confirmed |
| `bmad-agent-builder/references/agent-type-guidance.md` | Local file | Confirmed |
| `bmad-agent-builder/assets/SKILL-template.md` | Local file | Confirmed |
| `bmad-agent-builder/assets/SKILL-template-bootloader.md` | Local file | Confirmed |
| `bmad-agent-builder/assets/customize-template.toml` | Local file | Confirmed |
| `_bmad/_config/agents/bmm-analyst.customize.yaml` | Local file | Confirmed |
| `sentry-protocol-drift/SKILL.md` | Local file | Confirmed |
| `develop.sentry.dev/sdk/foundations/transport/envelopes/` | Live fetch | Confirmed |
| `develop.sentry.dev/sdk/foundations/transport/envelope-items/` | Live fetch | Confirmed |
| `develop.sentry.dev/sdk/foundations/data-model/event-payloads/` | Live fetch | Confirmed |
| `github.com/getsentry/relay` (repo overview) | Live fetch | Confirmed |
| `github.com/getsentry/sentry-data-schemas` (repo overview) | Live fetch | Confirmed |
| `open.sentry.io/repos/` | Live fetch | Confirmed |

---

## Proposed Agent Structure

```
skills/agent-sentry-expert/           # or: agent-sentry (shorter)
├── SKILL.md                          # Full stateless identity + activation + capabilities routing
├── customize.toml                    # [agent] metadata + persistent_facts → sidecar
├── references/
│   ├── buscar.md                     # Search Relay/schema repos for implementation
│   ├── auditar.md                    # Rustrak vs Relay/spec gap analysis (parallel subagents)
│   ├── flujo.md                      # Trace envelope lifecycle through Relay source
│   ├── protocolo.md                  # Look up exact protocol spec for a feature
│   ├── fixture.md                    # Extract real test payloads from Relay/SDK repos
│   └── doc.md                        # Fetch develop.sentry.dev docs
└── scripts/                          # Optional: helper for sparse clone setup
```

Sidecar (accumulates knowledge across sessions):
```
_bmad/memory/agent-sentry-expert/
├── memories.md                       # Notable Rustrak/Sentry findings
├── instructions.md                   # Anti-hallucination rules, search strategy
├── relay-key-objects.md              # Important Relay crates/structs
└── rustrak-sentry-map.md             # How Rustrak implements each Sentry protocol piece
```

---

## Next Steps

1. Confirm agent name (proposed: `agent-sentry-expert`)
2. Confirm repos to clone and sparse paths
3. Build with `bmad-agent-builder` using stateless template + sidecar pattern
4. Wire `customize.toml` `persistent_facts` to sidecar files
5. Ensure commands don't duplicate `sentry-protocol-drift` (that skill monitors; this agent investigates)
