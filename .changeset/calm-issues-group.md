---
"@rustrak/server": "patch"
---

Issue grouping reaches Sentry parity: `logentry.formatted` is read for the
issue title while grouping stays on the message template, messages are
parameterized before grouping, the exception-tree walk is depth-bounded and
cycle-safe, issues group by every exception in the chain and follow their
latest event's title, level and culprit, and the previous grouping key is
frozen as a fallback so existing issues migrate instead of forking.
