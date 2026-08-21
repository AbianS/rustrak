---
"@rustrak/server": "patch"
---

Fix the agent trace waterfall growing past the viewport when a span label is very long, pushing the span detail panel out of view. The waterfall pane now shrinks and truncates instead.
