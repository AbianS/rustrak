---
"docs": "patch"
---

Fix the ASCII paintings not rendering on the published site. `AsciiField` fetched its source with an absolute path, and Next's `basePath` does not rewrite a string handed to `fetch`, so under GitHub Pages the request resolved against the domain root instead of `/rustrak/` and returned a 404. The hero, manifesto and closing sections all went blank with no error on the page.
