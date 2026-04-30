# LLM Error Analysis System

## Overview

An optional LLM-powered analysis feature that examines issue stacktraces and event context to provide root cause explanations, suggested fixes, and affected code paths. Users configure global LLM provider credentials in Settings, then trigger analysis per-issue from the event detail view. Analysis runs asynchronously via a database-backed durable queue.

## Crate: `genai`

**`jeremychone/rust-genai`** (748 stars, 25K downloads, v0.6.0-beta)

Native support for the providers Rustrak users would want:

| Provider | Model Prefix | Env Var |
|----------|-------------|---------|
| OpenAI | `gpt-*`, `o1-*`, `o3-*`, `o4-*` | `OPENAI_API_KEY` |
| Anthropic | `claude-*` | `ANTHROPIC_API_KEY` |
| Gemini | `gemini-*` | `GEMINI_API_KEY` |
| DeepSeek | `deepseek-*` | `DEEPSEEK_API_KEY` |
| xAI / Grok | `grok-*` | `XAI_API_KEY` |
| OpenRouter | any (via `ServiceTargetResolver`) | `OPENROUTER_API_KEY` |
| Ollama | fallback (local) | none |

Key capabilities:
- Auto-resolves adapter from model name (`claude-sonnet-4-5` → Anthropic)
- `AuthResolver` trait for injecting API keys at runtime (not just env vars)
- Non-streaming mode ideal for batch analysis
- `ReasoningEffort` support for Anthropic/Gemini thinking models

### Cargo.toml

```toml
genai = "0.6"
```

## Database Schema

### `llm_provider_configs` — global, managed in Settings

```sql
CREATE TABLE llm_provider_configs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,           -- "My OpenAI Key"
    provider VARCHAR(20) NOT NULL,               -- openai, anthropic, gemini, deepseek, openrouter, ollama
    api_key TEXT NOT NULL,                        -- stored encrypted or redacted on read via GET
    base_url VARCHAR(255),                        -- override for proxies (OpenRouter: https://openrouter.ai/api/v1)
    default_model VARCHAR(100) NOT NULL,          -- "gpt-4o" or "openrouter::openai/gpt-4o"
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**API key security:** `GET /api/llm/providers` returns redacted keys (`"sk-...xyz"`). Full key only available via `GET /api/llm/providers/:id` and only for authenticated session. Future: encrypt at rest with a server-side secret.

### `llm_analyses` — per-issue analysis history + queue

```sql
CREATE TYPE llm_analysis_status AS ENUM ('pending', 'running', 'completed', 'failed');

CREATE TABLE llm_analyses (
    id SERIAL PRIMARY KEY,
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    event_id UUID,                               -- specific event analyzed (NULL = latest at trigger time)
    provider_config_id INTEGER NOT NULL REFERENCES llm_provider_configs(id) ON DELETE RESTRICT,
    model VARCHAR(100) NOT NULL,                 -- actual model used (may differ from default_model)
    status llm_analysis_status NOT NULL DEFAULT 'pending',
    prompt TEXT,                                 -- full prompt sent to LLM
    response TEXT,                               -- markdown response from LLM
    error_message TEXT,                          -- if status = 'failed'
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_llm_analyses_issue ON llm_analyses(issue_id, created_at DESC);
CREATE INDEX idx_llm_analyses_pending ON llm_analyses(created_at) WHERE status = 'pending';
```

**Durable queue pattern:** `status = 'pending'` rows are picked up by a background poller. This survives restarts — pending analyses persist in Postgres.

## API Endpoints

### LLM Provider Config (Global Settings)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/llm/providers` | Session | List all provider configs (api_key redacted) |
| `POST` | `/api/llm/providers` | Session | Create provider config |
| `PATCH` | `/api/llm/providers/:id` | Session | Update provider config |
| `DELETE` | `/api/llm/providers/:id` | Session | Delete provider config |

### LLM Analysis (Per-Issue)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/projects/:pid/issues/:iid/llm-analysis` | Session | Trigger analysis (inserts `pending` row, returns `{ id, status }`) |
| `GET` | `/api/projects/:pid/issues/:iid/llm-analysis` | Session | List all analyses for this issue (latest first) |
| `GET` | `/api/llm/analysis/:id` | Session | Get specific analysis result |

### Request/Response Examples

**POST trigger analysis:**
```json
// Request
{ "provider_config_id": 1, "model": "gpt-4o" }
// Response (202 Accepted)
{ "id": 42, "status": "pending" }
```

**GET analysis result:**
```json
{
  "id": 42,
  "issue_id": "abc-123",
  "model": "gpt-4o",
  "status": "completed",
  "response": "## Root Cause\n\nThe `TypeError` on line 42 occurs because...",
  "prompt_tokens": 850,
  "completion_tokens": 320,
  "total_tokens": 1170,
  "created_at": "2026-04-28T14:00:00Z"
}
```

## Processing Flow

```
User clicks "Run Analysis"
       │
       ▼
POST /api/.../llm-analysis
       │
       ▼
INSERT INTO llm_analyses (status = 'pending')
       │
       ▼
Return 202 { id, status: "pending" }
       │
       │  (UI polls GET /api/llm/analysis/:id)
       │
       ▼
Background worker picks up pending row
       │
       ├─ SET status = 'running'
       │
       ├─ Fetch latest event for issue
       │
       ├─ Build prompt from stacktrace + breadcrumbs + tags
       │
       ├─ Call genai::Client::exec_chat(model, chat_req)
       │
       ├─ SET status = 'completed', response = ..., tokens_used = ...
       │
       └─ On error: SET status = 'failed', error_message = ...
```

## Agent (Background Worker)

A lightweight poller in `main.rs` that runs on a loop:

```rust
// Pseudo-code
loop {
    let pending = find_pending_analyses(&pool).await?;
    for analysis in pending {
        tokio::spawn(run_analysis(pool.clone(), analysis));
    }
    tokio::time::sleep(Duration::from_secs(2)).await;
}
```

- Polls every 2 seconds for `pending` rows
- Spawns one task per analysis (concurrent processing)
- Respects provider rate limits via the genai crate's retry
- On failure: records error, sets `status = 'failed'`

## Prompt Template (Initial)

System prompt sent to the LLM:

```
You are an error analysis assistant for a software error tracking system.
Analyze the following error event and provide a concise explanation:

1. ROOT CAUSE: What caused this error? (2-3 sentences)
2. LIKELY FIX: What code change would resolve it? (1-3 specific suggestions)
3. AFFECTED PATH: Which code paths, functions, or modules are involved?

Event details:
- Error type: {exception_type}
- Error message: {exception_value}
- Transaction: {transaction}
- Environment: {environment}
- Platform: {platform}

Stack trace:
{stacktrace}

Breadcrumbs:
{breadcrumbs}

Tags: {tags}
```

## File Plan

### Server (`apps/server`)

```
src/models/llm.rs                       # LlmProvider, LlmProviderConfig, LlmAnalysis, DTOs
src/models/mod.rs                       # + pub mod llm; + re-exports
src/services/llm.rs                     # LlmService: CRUD + run_analysis (genai integration)
src/routes/llm_providers.rs            # GET/POST/PATCH/DELETE /api/llm/providers
src/routes/llm_analysis.rs             # POST trigger + GET list + GET detail
src/routes/mod.rs                       # + pub mod llm_providers; + pub mod llm_analysis
src/digest/llm_worker.rs               # Background poller + analysis runner
src/main.rs                             # Spawn llm_worker on startup
migrations/postgres/XXXXXXXX_create_llm.sql  # llm_provider_configs + llm_analyses + enum
```

### Client Package (`packages/client`)

```
src/schemas/llm.ts                      # Zod schemas
src/types/llm.ts                        # TypeScript types (z.infer)
src/resources/llm-providers.ts         # LlmProvidersResource
src/resources/llm-analyses.ts          # LlmAnalysesResource
src/resources/index.ts                  # Re-exports
src/client.ts                           # Add llmProviders, llmAnalyses to RustrakClient
```

### WebView UI (`apps/webview-ui`)

```
src/app/(main)/settings/llm/
  page.tsx                              # LLM Providers settings page (server)
  llm-providers-list.tsx               # Provider cards + create/edit/delete dialogs (client)
src/app/(main)/projects/[id]/issues/[issueId]/events/[eventId]/
  llm-analysis.tsx                      # NEW tab: select provider/model, run, view results
  page.tsx                              # Add "LLM Analysis" tab to TabsList
src/actions/llm.ts                      # Server actions for providers + analyses
src/app/(main)/settings/settings-nav.tsx # Add "LLM Providers" nav item
```

### Settings Nav Update

```tsx
// settings-nav.tsx — add new item:
{
  href: '/settings/llm',
  label: 'LLM Providers',
  icon: Brain,  // or Sparkles from lucide-react
}
```

### Event Detail Tab Update

```tsx
// events/[eventId]/page.tsx — add new tab:
<TabsTrigger value="llm-analysis">LLM Analysis</TabsTrigger>
// ...
<TabsContent value="llm-analysis" className="mt-6">
  <LlmAnalysis issueId={issueId} event={event} />
</TabsContent>
```

## UI Flow

1. **Settings → LLM Providers**: Admin adds API keys (e.g., "Production OpenAI" with key `sk-...`)
2. **Project → Issue → Event → LLM Analysis tab**:
   - Dropdown: Select provider (from enabled configs)
   - Dropdown: Select model (free-text with default from provider config)
   - Button: "Run Analysis"
   - Shows spinner while `status = 'pending' | 'running'` (polls every 2s)
   - Shows rendered markdown analysis when `status = 'completed'`
   - Shows error message if `status = 'failed'`
   - Button: "Re-run" (creates new analysis row)
   - History: Dropdown of past analyses for this issue

## Design Decisions

1. **Global keys, per-issue analysis** — Keys are set at the org level (Settings). Analysis is triggered per-issue. Project-level overrides deferred.
2. **One config per key** — `llm_provider_configs` stores one row per API key + provider combo. Users can add multiple (e.g., one for OpenAI, one for Anthropic).
3. **Re-run = new row** — Each analysis run creates a new `llm_analyses` row. Keeps full history. UI shows latest first with a dropdown of past runs.
4. **Analyze latest event** — When triggering, the worker fetches the issue's latest event. If `event_id` is provided, uses that specific event.
5. **Key redaction in list** — `GET /api/llm/providers` returns masked keys (`"sk-...abc"`). Single-item GET returns the full key (only the owner can see it in the edit dialog).
6. **No streaming** — Non-streaming mode. LLM calls are batch-oriented (full response at once). Simpler than SSE.
7. **Rate limiting** — genai handles retry internally. We add a concurrency cap in the worker (max 3 concurrent analyses).
