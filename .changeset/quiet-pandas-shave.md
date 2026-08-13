---
"docs": "patch"
---

The landing's hydration flag moves from `useState` plus a mount effect to `useSyncExternalStore`, so the correction lands before the first paint instead of after it. Site dependencies updated, including motion 12 to 13.
