---
"@rustrak/server": "patch"
---

The dashboard is internationalized and ships English and Chinese (@LiJoeAllen). Language is picked in `/settings/account` and stored on the user account rather than in a cookie, so it follows the reader to another browser; before a choice is made it follows `Accept-Language`. Timezone moves onto the account the same way, adopting the browser's zone once when unset. Dates and numbers now format in the reader's locale everywhere, and `date-fns` is gone. The server gains nullable `language` and `timezone` columns on the user and accepts either through `PATCH /auth/me`.
