# webview-ui

## 0.1.6

### Patch Changes

- [#44](https://github.com/AbianS/rustrak/pull/44) [`4a84415`](https://github.com/AbianS/rustrak/commit/4a84415d867b5a1f15f11006278527671d62b242) Thanks [@AbianS](https://github.com/AbianS)! - Upgrade all dependencies to latest versions across the monorepo.

  - TypeScript 6.0.3 + Node.js engines >=22 across all packages
  - ky 2.x migration: `prefix` (was `prefixUrl`), updated hook signatures, removed 429 from retry list to avoid `Retry-After` sleep
  - lucide-react 1.x: replaced removed `Github` brand icon with inline SVG component
  - Rust: actix-web 4.13, actix-session 0.11, tokio 1.52, sqlx 0.8.6, rand 0.10 (`RngExt`), sha2 0.11 (`hex::encode`), hmac 0.13 (`KeyInit`)

- Updated dependencies [[`4a84415`](https://github.com/AbianS/rustrak/commit/4a84415d867b5a1f15f11006278527671d62b242)]:
  - @rustrak/client@0.1.1

## 0.1.5

### Patch Changes

- [#34](https://github.com/AbianS/rustrak/pull/34) [`54efbba`](https://github.com/AbianS/rustrak/commit/54efbba72d56130d3d3b987faf9b829c6041ab3e) Thanks [@AbianS](https://github.com/AbianS)! - chore: update dependencies

## 0.1.4

### Patch Changes

- [#23](https://github.com/AbianS/rustrak/pull/23) [`169dc0c`](https://github.com/AbianS/rustrak/commit/169dc0ce73fee276b169f403daa0ed4a00404726) Thanks [@AbianS](https://github.com/AbianS)! - feat: system alert

## 0.1.3

### Patch Changes

- [`17291c5`](https://github.com/AbianS/rustrak/commit/17291c54ed7e41f9577588aeef29107194186199) Thanks [@AbianS](https://github.com/AbianS)! - fix: favicon

## 0.1.2

### Patch Changes

- [`2f7a450`](https://github.com/AbianS/rustrak/commit/2f7a450263e2fc3357c5cda614e24774810fa373) Thanks [@AbianS](https://github.com/AbianS)! - chore: second version

## 0.1.1

### Patch Changes

- [`08a1262`](https://github.com/AbianS/rustrak/commit/08a12627dbdf1a044d3a66b25b1ee113583f57f8) Thanks [@AbianS](https://github.com/AbianS)! - chore: first version
