---
"webview-ui": patch
---

Normalize numeric and RFC3339 timestamps on transaction-embedded spans before
rendering the performance waterfall. This prevents Sentry SDKs that emit mixed
timestamp representations from displaying `NaN` duration and self-time values.
