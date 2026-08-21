---
"@rustrak/server": "patch"
---

Fix the dashboard Docker image crash-looping on startup. Next.js 16.3.1 ships @swc/helpers 0.5.23, whose `module-sync` exports condition makes `require()` on Node >= 22.10 resolve to `esm/` files that the standalone output trace never includes. Pin `next>@swc/helpers` to 0.5.15 until Next traces the `esm/` directory (vercel/next.js#93852).
