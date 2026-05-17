# @rustrak/mcp

## 0.1.1

### Patch Changes

- [`40ba761`](https://github.com/AbianS/rustrak/commit/40ba76136d2c455fc22fcc1b99850eb3d29769bd) Thanks [@AbianS](https://github.com/AbianS)! - **server**: migrate all alert-channel and alert-rule endpoints from `AuthenticatedUser` to `ApiAuth` extractor, enabling bearer token access to the alerts API

  **client**: remove `private` flag and add `publishConfig` for npm publishing; bump zod to 4.4.3, msw to 2.14.6, vitest to 4.1.6, @types/node to 25.8.0

  **mcp**: wire npm publish in CI pipeline for initial public release of `@rustrak/mcp`

- Updated dependencies [[`40ba761`](https://github.com/AbianS/rustrak/commit/40ba76136d2c455fc22fcc1b99850eb3d29769bd)]:
  - @rustrak/client@0.1.2
