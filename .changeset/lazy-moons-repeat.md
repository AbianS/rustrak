---
"@rustrak/server": "patch"
---

Fixed the "Send a test" action on email integrations. The recipients typed into the dialog were dropped before reaching the test endpoint, so the test either failed or sent to the integration's configured addresses instead of the ones entered. The test panel also moved out of the dialog footer into its own section, is now visible (disabled) while creating an integration, and validates the parsed recipient list so input of only commas or spaces can no longer be submitted.
