# Memory

_Curated long-term knowledge. Empty at birth — grows through sessions._

_This file is for distilled insights: protocol behaviors that surprised us, Rustrak implementation decisions, patterns in Relay's normalization logic, lessons learned. Not raw notes — those go in `sessions/YYYY-MM-DD.md`._

_Keep under 200 lines. Every token here loads every session — make each one count. See `references/memory-guidance.md` for full discipline._

---

## Source Map Protocol Facts (verified 2026-05-25)

**Relay does NOT process source maps.** It only forwards chunk-upload and artifact-bundle endpoints to the upstream backend. Quote from `relay-server/src/lib.rs`: *"sourcemap processing... of no concern to Relay."* For Rustrak, this means Rustrak IS the backend and must implement everything.

**sentry-cli v3 POLLS for state=ok.** The assemble endpoint is designed to be async — it returns `"created"` immediately, then sentry-cli polls until `"ok"`. The background worker is protocol-required, not overengineered.

**Two different "type" fields — do not confuse:**
- `event.debug_meta.images[n].type = "sourcemap"` (no underscore) — identifies a debug image in the event protocol
- `manifest.json files[path].type = "source_map"` (with underscore) — file type inside the artifact bundle ZIP

**chunk upload field name:** sentry-cli names each multipart field with the SHA1 of its content. The server MUST verify `computed_sha1 == field_name` and return 400 on mismatch — otherwise a corrupted upload causes an infinite "missing chunks" loop.

**ON CONFLICT clause for assembly_jobs:** The `SET` clause must include `chunks = EXCLUDED.chunks` — otherwise a re-assemble with a different chunk list silently uses stale chunks.

## Frontend IA Facts (verified 2026-07-03)

**"Release Health" is a dataset, not a destination, in Sentry's real frontend.** No page, tab, or button anywhere in `static/app/views/` is called "Release Health". It's embedded in: project dashboard score cards, the releases list (with a CTA to enable it), and a release's default "Overview" detail tab. When auditing whether Rustrak put a concept "in the right place," check first whether Sentry treats it as a navigable destination at all — often it doesn't, and the real fix is de-emphasizing a standalone UI element rather than relocating it.

**`/projects/:projectId/` is a dashboard in Sentry, never a redirect to issues** — and the issue stream itself is org-scoped (`/organizations/:orgId/issues/`), not nested under a project route. Two separate IA facts, easy to conflate.
