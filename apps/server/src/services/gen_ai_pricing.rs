//! Model pricing table + cost calculation (story-ai-agent-monitoring.md, GH #180).
//!
//! Port of Relay's `calculate_costs`/`UsedTokens`/`ModelCostV2`
//! (relay-event-normalization/src/normalize/span/ai.rs). Rustrak is
//! self-hosted and has no access to Sentry SaaS's live pricing config, so
//! this ships its own static table instead.
//!
//! Rates below are approximate, curated at implementation time from
//! publicly known provider pricing pages (USD per token, i.e. published
//! per-million-token list price / 1_000_000). They are NOT guaranteed
//! current — providers change pricing without notice. Treat this as a
//! best-effort estimate, not a billing-grade source of truth, and update
//! entries periodically against each provider's current pricing page.
//!
//! To add/update a model: add a `(prefix, ModelCost)` tuple to
//! [`PRICING_TABLE`]. Matching is exact-first, then longest-prefix (so
//! `"gpt-4o-2024-08-06"` resolves to the `"gpt-4o"` entry, and
//! `"gpt-4o-mini-2024-07-18"` resolves to the more specific `"gpt-4o-mini"`
//! entry rather than the shorter `"gpt-4o"` prefix) — order in the table
//! doesn't matter, matching picks the longest matching key automatically.

/// Per-token cost rates for one model. All rates are USD per single token.
#[derive(Debug, Clone, Copy)]
pub struct ModelCost {
    pub input_per_token: f64,
    pub output_per_token: f64,
    /// Rate for reasoning tokens. Falls back to `output_per_token` if 0.0 —
    /// most providers don't differentiate reasoning-token cost.
    pub output_reasoning_per_token: f64,
    pub input_cached_per_token: f64,
    pub input_cache_write_per_token: f64,
}

/// Token usage extracted from a span's `gen_ai.usage.*` attributes.
#[derive(Debug, Clone, Copy, Default)]
pub struct UsedTokens {
    pub input_tokens: f64,
    /// Subset of `input_tokens` already billed at the cached rate.
    pub input_cached_tokens: f64,
    /// Subset of `input_tokens` billed at the cache-write rate.
    pub input_cache_write_tokens: f64,
    pub output_tokens: f64,
    /// Subset of `output_tokens` billed at the reasoning rate.
    pub output_reasoning_tokens: f64,
}

impl UsedTokens {
    fn has_usage(&self) -> bool {
        self.input_tokens > 0.0 || self.output_tokens > 0.0
    }

    fn raw_input_tokens(&self) -> f64 {
        self.input_tokens - self.input_cached_tokens - self.input_cache_write_tokens
    }

    fn raw_output_tokens(&self) -> f64 {
        self.output_tokens - self.output_reasoning_tokens
    }
}

/// Calculated cost for a model call, in USD.
#[derive(Debug, Clone, Copy)]
pub struct CalculatedCost {
    pub input: f64,
    pub output: f64,
}

impl CalculatedCost {
    pub fn total(&self) -> f64 {
        self.input + self.output
    }
}

/// USD per 1M tokens, converted to per-token by dividing by 1e6.
const fn per_million(usd: f64) -> f64 {
    usd / 1_000_000.0
}

/// (model id prefix, cost rates). See module docs for matching rules and
/// the update procedure.
static PRICING_TABLE: &[(&str, ModelCost)] = &[
    (
        "gpt-4o-mini",
        ModelCost {
            input_per_token: per_million(0.15),
            output_per_token: per_million(0.60),
            output_reasoning_per_token: 0.0,
            input_cached_per_token: per_million(0.075),
            input_cache_write_per_token: 0.0,
        },
    ),
    (
        "gpt-4o",
        ModelCost {
            input_per_token: per_million(2.50),
            output_per_token: per_million(10.00),
            output_reasoning_per_token: 0.0,
            input_cached_per_token: per_million(1.25),
            input_cache_write_per_token: 0.0,
        },
    ),
    (
        "gpt-4-turbo",
        ModelCost {
            input_per_token: per_million(10.00),
            output_per_token: per_million(30.00),
            output_reasoning_per_token: 0.0,
            input_cached_per_token: 0.0,
            input_cache_write_per_token: 0.0,
        },
    ),
    (
        "gpt-4",
        ModelCost {
            input_per_token: per_million(30.00),
            output_per_token: per_million(60.00),
            output_reasoning_per_token: 0.0,
            input_cached_per_token: 0.0,
            input_cache_write_per_token: 0.0,
        },
    ),
    (
        "gpt-3.5-turbo",
        ModelCost {
            input_per_token: per_million(0.50),
            output_per_token: per_million(1.50),
            output_reasoning_per_token: 0.0,
            input_cached_per_token: 0.0,
            input_cache_write_per_token: 0.0,
        },
    ),
    (
        "o1-mini",
        ModelCost {
            input_per_token: per_million(3.00),
            output_per_token: per_million(12.00),
            output_reasoning_per_token: per_million(12.00),
            input_cached_per_token: per_million(1.50),
            input_cache_write_per_token: 0.0,
        },
    ),
    (
        "o1",
        ModelCost {
            input_per_token: per_million(15.00),
            output_per_token: per_million(60.00),
            output_reasoning_per_token: per_million(60.00),
            input_cached_per_token: per_million(7.50),
            input_cache_write_per_token: 0.0,
        },
    ),
    (
        "claude-3-5-sonnet",
        ModelCost {
            input_per_token: per_million(3.00),
            output_per_token: per_million(15.00),
            output_reasoning_per_token: 0.0,
            input_cached_per_token: per_million(0.30),
            input_cache_write_per_token: per_million(3.75),
        },
    ),
    (
        "claude-3-5-haiku",
        ModelCost {
            input_per_token: per_million(0.80),
            output_per_token: per_million(4.00),
            output_reasoning_per_token: 0.0,
            input_cached_per_token: per_million(0.08),
            input_cache_write_per_token: per_million(1.00),
        },
    ),
    (
        "claude-3-opus",
        ModelCost {
            input_per_token: per_million(15.00),
            output_per_token: per_million(75.00),
            output_reasoning_per_token: 0.0,
            input_cached_per_token: per_million(1.50),
            input_cache_write_per_token: per_million(18.75),
        },
    ),
    (
        "claude-3-sonnet",
        ModelCost {
            input_per_token: per_million(3.00),
            output_per_token: per_million(15.00),
            output_reasoning_per_token: 0.0,
            input_cached_per_token: 0.0,
            input_cache_write_per_token: 0.0,
        },
    ),
    (
        "claude-3-haiku",
        ModelCost {
            input_per_token: per_million(0.25),
            output_per_token: per_million(1.25),
            output_reasoning_per_token: 0.0,
            input_cached_per_token: per_million(0.03),
            input_cache_write_per_token: per_million(0.30),
        },
    ),
    (
        "gemini-1.5-pro",
        ModelCost {
            input_per_token: per_million(1.25),
            output_per_token: per_million(5.00),
            output_reasoning_per_token: 0.0,
            input_cached_per_token: 0.0,
            input_cache_write_per_token: 0.0,
        },
    ),
    (
        "gemini-1.5-flash",
        ModelCost {
            input_per_token: per_million(0.075),
            output_per_token: per_million(0.30),
            output_reasoning_per_token: 0.0,
            input_cached_per_token: 0.0,
            input_cache_write_per_token: 0.0,
        },
    ),
    (
        "gemini-2.0-flash",
        ModelCost {
            input_per_token: per_million(0.10),
            output_per_token: per_million(0.40),
            output_reasoning_per_token: 0.0,
            input_cached_per_token: 0.0,
            input_cache_write_per_token: 0.0,
        },
    ),
];

/// Looks up cost rates for a model id. Tries an exact match first, then the
/// longest table entry that's a prefix of `model` (handles dated snapshot
/// ids like `"gpt-4o-2024-08-06"`). Returns `None` for unknown models.
pub fn cost_for_model(model: &str) -> Option<&'static ModelCost> {
    if let Some((_, cost)) = PRICING_TABLE.iter().find(|(key, _)| *key == model) {
        return Some(cost);
    }
    PRICING_TABLE
        .iter()
        .filter(|(key, _)| model.starts_with(key))
        .max_by_key(|(key, _)| key.len())
        .map(|(_, cost)| cost)
}

/// Calculates cost for a model call given its usage tokens. `None` if the
/// model is unrecognized or no tokens were used.
pub fn calculate_cost(model: &str, tokens: &UsedTokens) -> Option<CalculatedCost> {
    let rates = cost_for_model(model)?;
    calculate_cost_with_rates(tokens, rates)
}

/// Pure cost formula, exact port of Relay's `calculate_costs`. Exposed
/// separately from [`calculate_cost`] so it can be exercised directly with
/// literal rates in tests, without depending on the pricing table's
/// contents.
pub fn calculate_cost_with_rates(tokens: &UsedTokens, rates: &ModelCost) -> Option<CalculatedCost> {
    if !tokens.has_usage() {
        return None;
    }

    let input = (tokens.raw_input_tokens() * rates.input_per_token)
        + (tokens.input_cached_tokens * rates.input_cached_per_token)
        + (tokens.input_cache_write_tokens * rates.input_cache_write_per_token);

    let reasoning_rate = if rates.output_reasoning_per_token > 0.0 {
        rates.output_reasoning_per_token
    } else {
        rates.output_per_token
    };

    let output = (tokens.raw_output_tokens() * rates.output_per_token)
        + (tokens.output_reasoning_tokens * reasoning_rate);

    Some(CalculatedCost { input, output })
}
