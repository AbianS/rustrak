---
'@rustrak/server': minor
'docs': minor
---

Add a Custom Webhook alert integration. Its request body is rendered from a
user-supplied Minijinja template over the alert payload and must come out as
valid JSON, which lets one integration feed the fixed message schemas of group
bots — WeCom, DingTalk and Feishu — with preset templates in the dashboard to
start from. The existing Webhook integration is untouched.
