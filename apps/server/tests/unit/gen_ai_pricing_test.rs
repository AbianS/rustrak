//! Unit tests for gen_ai model pricing table + cost calculation
//! (story-ai-agent-monitoring.md, GH #180). Port of Relay's
//! `calculate_costs`/`UsedTokens` (relay-event-normalization/src/normalize/span/ai.rs).

use rustrak::services::gen_ai_pricing::{
    calculate_cost, calculate_cost_with_rates, cost_for_model, ModelCost, UsedTokens,
};

// =============================================================================
// cost_for_model — lookup (exact + longest-prefix match)
// =============================================================================

#[test]
fn test_cost_for_model_exact_match() {
    assert!(cost_for_model("gpt-4o").is_some());
}

#[test]
fn test_cost_for_model_prefix_match_with_date_suffix() {
    // Real SDKs often send a dated snapshot id, e.g. "gpt-4o-2024-08-06".
    assert!(cost_for_model("gpt-4o-2024-08-06").is_some());
}

#[test]
fn test_cost_for_model_longest_prefix_wins() {
    // "gpt-4o-mini-2024-07-18" must match the "gpt-4o-mini" entry, not the
    // shorter "gpt-4o" entry (which is also a string-prefix of it).
    let mini = cost_for_model("gpt-4o-mini-2024-07-18").unwrap();
    let full = cost_for_model("gpt-4o-2024-08-06").unwrap();
    assert!(
        mini.input_per_token < full.input_per_token,
        "gpt-4o-mini must resolve to the cheaper mini pricing, not gpt-4o's"
    );
}

#[test]
fn test_cost_for_model_unknown_returns_none() {
    assert!(cost_for_model("some-unreleased-model-nobody-has-heard-of").is_none());
}

// =============================================================================
// calculate_cost — exact port of Relay's formula
// =============================================================================

#[test]
fn test_calculate_cost_no_tokens_returns_none() {
    let tokens = UsedTokens {
        input_tokens: 0.0,
        input_cached_tokens: 0.0,
        input_cache_write_tokens: 0.0,
        output_tokens: 0.0,
        output_reasoning_tokens: 0.0,
    };
    assert!(calculate_cost("gpt-4o", &tokens).is_none());
}

#[test]
fn test_calculate_cost_unknown_model_returns_none() {
    let tokens = UsedTokens {
        input_tokens: 100.0,
        input_cached_tokens: 0.0,
        input_cache_write_tokens: 0.0,
        output_tokens: 50.0,
        output_reasoning_tokens: 0.0,
    };
    assert!(calculate_cost("totally-unknown-model", &tokens).is_none());
}

// =============================================================================
// calculate_cost_with_rates — pure formula, exercised with literal rates
// (mirrors how Relay's own tests pass a literal ModelCostV2, not a lookup)
// =============================================================================

#[test]
fn test_calculate_cost_with_rates_full_formula() {
    let rates = ModelCost {
        input_per_token: 1.0,
        output_per_token: 2.0,
        output_reasoning_per_token: 3.0,
        input_cached_per_token: 0.5,
        input_cache_write_per_token: 0.75,
    };
    let tokens = UsedTokens {
        input_tokens: 8.0,
        input_cached_tokens: 5.0,
        input_cache_write_tokens: 0.0,
        output_tokens: 15.0,
        output_reasoning_tokens: 9.0,
    };
    let cost = calculate_cost_with_rates(&tokens, &rates).unwrap();
    // input: (8-5-0)*1.0 + 5*0.5 + 0*0.75 = 3 + 2.5 = 5.5
    // output: (15-9)*2.0 + 9*3.0 = 12 + 27 = 39.0
    assert!((cost.input - 5.5).abs() < 1e-9);
    assert!((cost.output - 39.0).abs() < 1e-9);
    assert!((cost.total() - 44.5).abs() < 1e-9);
}

#[test]
fn test_calculate_cost_with_rates_reasoning_falls_back_to_output_rate() {
    // output_reasoning_per_token == 0.0 → falls back to the standard output
    // rate (Relay's documented fallback behavior).
    let rates = ModelCost {
        input_per_token: 1.0,
        output_per_token: 2.0,
        output_reasoning_per_token: 0.0,
        input_cached_per_token: 0.5,
        input_cache_write_per_token: 0.0,
    };
    let tokens = UsedTokens {
        input_tokens: 8.0,
        input_cached_tokens: 5.0,
        input_cache_write_tokens: 0.0,
        output_tokens: 15.0,
        output_reasoning_tokens: 9.0,
    };
    let cost = calculate_cost_with_rates(&tokens, &rates).unwrap();
    // output: (15-9)*2.0 + 9*2.0(fallback) = 12 + 18 = 30.0
    assert!((cost.output - 30.0).abs() < 1e-9);
}

#[test]
fn test_calculate_cost_with_rates_cache_write_billed_separately_from_input() {
    let rates = ModelCost {
        input_per_token: 1.0,
        output_per_token: 2.0,
        output_reasoning_per_token: 3.0,
        input_cached_per_token: 0.5,
        input_cache_write_per_token: 0.75,
    };
    let tokens = UsedTokens {
        input_tokens: 100.0,
        input_cached_tokens: 20.0,
        input_cache_write_tokens: 30.0,
        output_tokens: 50.0,
        output_reasoning_tokens: 10.0,
    };
    let cost = calculate_cost_with_rates(&tokens, &rates).unwrap();
    // input: (100-20-30)*1.0 + 20*0.5 + 30*0.75 = 50 + 10 + 22.5 = 82.5
    assert!((cost.input - 82.5).abs() < 1e-9);
}

#[test]
fn test_calculate_cost_with_rates_no_usage_returns_none() {
    let rates = ModelCost {
        input_per_token: 1.0,
        output_per_token: 1.0,
        output_reasoning_per_token: 1.0,
        input_cached_per_token: 1.0,
        input_cache_write_per_token: 1.0,
    };
    let tokens = UsedTokens {
        input_tokens: 0.0,
        input_cached_tokens: 0.0,
        input_cache_write_tokens: 0.0,
        output_tokens: 0.0,
        output_reasoning_tokens: 0.0,
    };
    assert!(calculate_cost_with_rates(&tokens, &rates).is_none());
}
