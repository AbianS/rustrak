# docs

## 0.1.13

### Patch Changes

- [`3fc4abb`](https://github.com/AbianS/rustrak/commit/3fc4abba96170c7fbbac708aeb0296c7e759818c) Thanks [@AbianS](https://github.com/AbianS)! - ## webview-ui

  ### Features

  - **Skeleton loading states** — issue and event detail routes now show skeleton UI while fetching, eliminating layout shift on navigation
  - **Full mobile responsiveness** — projects page, project detail, settings section, event detail, and global header all adapted for small screens
  - **Base UI migration** — replaced all Radix UI primitives (shadcn/ui) with Base UI equivalents; corrected data attribute selectors and dropdown widths; rewired form a11y and tabs keyboard orientation
  - **Brand icon** — replaced generic Terminal icon with the Rustrak bolt SVG logo icon across the UI

  ### Bug Fixes

  - Fixed stale state on issue dropdown actions by passing `id` directly instead of through closure capture
  - Fixed sticky event sidebar not respecting viewport height
  - Fixed API docs link in tokens settings page
  - Restored correct keyboard orientation for tab components after Base UI migration

  ## @rustrak/server

  ### Maintenance

  - Updated Rust dependencies: tokio `1.52.1 → 1.52.3`, reqwest `0.13.2 → 0.13.3`, lettre `0.11.21 → 0.11.22`, sentry `0.47.0 → 0.48.2`, utoipa `5.x → 5.5.0`

  ## docs

  ### Content

  - Added initial Sentry protocol compatibility drift report documenting deviations between Rustrak's ingestion implementation and the official Sentry envelope protocol

## 0.1.12

### Patch Changes

- [#46](https://github.com/AbianS/rustrak/pull/46) [`c64ebe0`](https://github.com/AbianS/rustrak/commit/c64ebe09d1e2700faf956c757cb21402aa062e5a) Thanks [@AbianS](https://github.com/AbianS)! - Add interactive API reference powered by OpenAPI spec

## 0.1.11

### Patch Changes

- [#44](https://github.com/AbianS/rustrak/pull/44) [`4a84415`](https://github.com/AbianS/rustrak/commit/4a84415d867b5a1f15f11006278527671d62b242) Thanks [@AbianS](https://github.com/AbianS)! - Upgrade all dependencies to latest versions across the monorepo.

  - TypeScript 6.0.3 + Node.js engines >=22 across all packages
  - ky 2.x migration: `prefix` (was `prefixUrl`), updated hook signatures, removed 429 from retry list to avoid `Retry-After` sleep
  - lucide-react 1.x: replaced removed `Github` brand icon with inline SVG component
  - Rust: actix-web 4.13, actix-session 0.11, tokio 1.52, sqlx 0.8.6, rand 0.10 (`RngExt`), sha2 0.11 (`hex::encode`), hmac 0.13 (`KeyInit`)

## 0.1.10

### Patch Changes

- [#39](https://github.com/AbianS/rustrak/pull/39) [`447596b`](https://github.com/AbianS/rustrak/commit/447596b77655e6c8bc24257c603d1a992fb4cb03) Thanks [@kervel](https://github.com/kervel)! - SQLite is now the default database backend

  BREAKING CHANGE: The `latest` Docker image now uses SQLite instead of PostgreSQL.

  If you are using `abians7/rustrak-server:latest` with PostgreSQL, update your image tag:

  ```yaml
  # Before
  image: abians7/rustrak-server:latest

  # After
  image: abians7/rustrak-server:postgres
  ```

  No data migration required — only the image tag changes.

  New: SQLite support with zero configuration. No `DATABASE_URL` needed — data is stored automatically at `/data/rustrak.db` inside the container. Mount a volume at `/data` to persist data.

  Docker Hub now publishes two variants per release:

  - `latest` / `vX.Y.Z` → SQLite (default, no external database)
  - `postgres` / `vX.Y.Z-postgres` → PostgreSQL

  New "Database Backends" documentation page with SQLite vs PostgreSQL comparison, Docker Compose examples, and backup strategies.

## 0.1.9

### Patch Changes

- [#34](https://github.com/AbianS/rustrak/pull/34) [`54efbba`](https://github.com/AbianS/rustrak/commit/54efbba72d56130d3d3b987faf9b829c6041ab3e) Thanks [@AbianS](https://github.com/AbianS)! - chore: update dependencies

## 0.1.8

### Patch Changes

- [#23](https://github.com/AbianS/rustrak/pull/23) [`169dc0c`](https://github.com/AbianS/rustrak/commit/169dc0ce73fee276b169f403daa0ed4a00404726) Thanks [@AbianS](https://github.com/AbianS)! - feat: system alert

## 0.1.7

### Patch Changes

- [`931d8c9`](https://github.com/AbianS/rustrak/commit/931d8c96d86354ec8069ce317eef3a4426ca8cac) Thanks [@AbianS](https://github.com/AbianS)! - fix: video source github pages

## 0.1.6

### Patch Changes

- [`17291c5`](https://github.com/AbianS/rustrak/commit/17291c54ed7e41f9577588aeef29107194186199) Thanks [@AbianS](https://github.com/AbianS)! - fix: favicon

## 0.1.5

### Patch Changes

- [`433921b`](https://github.com/AbianS/rustrak/commit/433921b77a864f6974f467bc932fd943a6b908e1) Thanks [@AbianS](https://github.com/AbianS)! - fix: docs installation

## 0.1.4

### Patch Changes

- [`8a3cf61`](https://github.com/AbianS/rustrak/commit/8a3cf618d6d2cd48dbdbab4fa62cc2b8c53e4e22) Thanks [@AbianS](https://github.com/AbianS)! - fix: css

## 0.1.3

### Patch Changes

- [`1d9438d`](https://github.com/AbianS/rustrak/commit/1d9438d83f35ffe8460d7399ccc1d4c58d6b0b3a) Thanks [@AbianS](https://github.com/AbianS)! - chore: publish docs

## 0.1.2

### Patch Changes

- [`2f7a450`](https://github.com/AbianS/rustrak/commit/2f7a450263e2fc3357c5cda614e24774810fa373) Thanks [@AbianS](https://github.com/AbianS)! - chore: second version

## 0.1.1

### Patch Changes

- [`08a1262`](https://github.com/AbianS/rustrak/commit/08a12627dbdf1a044d3a66b25b1ee113583f57f8) Thanks [@AbianS](https://github.com/AbianS)! - chore: first version
