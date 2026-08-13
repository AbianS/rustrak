-- Cached-input and reasoning-output token counts (agents dashboard "Token
-- Types"). Both are SUBSETS of the input/output totals per OTel convention,
-- not additions to them, so they are stored beside the existing columns
-- rather than folded into them.
--
-- Nullable with no default on purpose: a provider that reports no prompt
-- caching must stay NULL so the dashboard can tell "not reported" from
-- "reported zero". A 0 default would silently turn the first into the second.
ALTER TABLE spans ADD COLUMN gen_ai_usage_cached_input_tokens     DOUBLE PRECISION;
ALTER TABLE spans ADD COLUMN gen_ai_usage_reasoning_output_tokens DOUBLE PRECISION;
