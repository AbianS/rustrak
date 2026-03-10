# Rustrak Docs App — Architecture

> **Component**: `apps/docs`
> **Framework**: Next.js 16.1 + Nextra 4.6
> **Port (dev)**: 3001

---

## 1. Overview

The `apps/docs` application is the official Rustrak documentation site. It uses [Nextra](https://nextra.site), a Next.js-based documentation framework, to render MDX content with automatic navigation, full-text search, and syntax highlighting.

The docs app is deliberately simple: it is a static site generator that turns MDX files into HTML. It has no authentication, no API calls, and no database. Anyone can contribute documentation by editing MDX files without needing Rust or TypeScript knowledge.

The site is deployed to **GitHub Pages** as a static export and is served independently from the Rustrak server and UI. It deploys automatically when a `docs@X.Y.Z` git tag is pushed.

---

## 2. Tech Stack

| Concern         | Technology              | Notes                                               |
|-----------------|-------------------------|-----------------------------------------------------|
| Framework       | Next.js 16.1            | Static export mode (`output: 'export'`)             |
| Docs layer      | Nextra 4.6              | MDX rendering, sidebar generation, search           |
| Theme           | nextra-theme-docs       | Official Nextra docs theme                          |
| Styling         | Tailwind CSS 4.x        | Extended by nextra-theme-docs                       |
| Content format  | MDX                     | Markdown + React components                         |
| Deployment      | GitHub Pages            | Static HTML from `out/` directory                   |
| CI/CD           | GitHub Actions          | Triggered on `docs@X.Y.Z` tag push                  |

---

## 3. Content Organization

Documentation content lives in the `content/` directory. Each subdirectory maps to a section in the sidebar. Files are named with a number prefix for ordering.

```
apps/docs/content/
├── getting-started/
│   ├── overview.mdx           # What Rustrak is, why it exists
│   ├── installation.mdx       # Docker, binary, from source
│   └── quickstart.mdx         # 5-minute setup guide
│
├── configuration/
│   ├── environment.mdx        # All environment variables, explained
│   ├── database.mdx           # SQLite vs PostgreSQL, migrations
│   └── production.mdx         # TLS, reverse proxy, backups
│
├── usage/
│   ├── projects.mdx           # Creating and managing projects, DSN setup
│   ├── issues.mdx             # Issue lifecycle, status, grouping
│   ├── tokens.mdx             # API token management
│   └── alerts.mdx             # Alert rules, channels, cooldowns
│
├── reference/
│   ├── api.mdx                # Complete REST API reference
│   ├── architecture.mdx       # High-level system architecture
│   └── contributing.mdx       # Development setup, PR guidelines
│
└── troubleshooting/
    ├── common-issues.mdx       # Frequently encountered problems + fixes
    └── faq.mdx                 # FAQ
```

### Sidebar Configuration

Nextra reads `_meta.json` files in each directory to control sidebar title and ordering. A typical `_meta.json`:

```json
{
  "overview": "Overview",
  "installation": "Installation",
  "quickstart": "Quickstart"
}
```

The key is the filename (without `.mdx`), the value is the display label in the sidebar.

---

## 4. Development Workflow

### Running Locally

```bash
# From monorepo root
pnpm --filter docs dev

# Or from the app directory
cd apps/docs
pnpm dev
```

The dev server starts on **port 3001** (to avoid conflict with webview-ui on 3000).

### Viewing Changes

Edit any `.mdx` file in `content/`. Next.js hot-reloads instantly. No build step is required to preview changes in development.

### Writing MDX

Nextra-flavored MDX supports standard Markdown plus:

- **Callout boxes**: `<Callout type="info">`, `<Callout type="warning">`, `<Callout type="error">`
- **Code blocks with filenames**: ````bash filename=".env"````
- **Tabbed content**: `<Tabs items={['Docker', 'Binary']}><Tab>...</Tab></Tabs>`
- **Steps**: `<Steps>### Step 1 ... ### Step 2 ...</Steps>`
- **Inline code**: standard backticks

---

## 5. Adding or Updating Documentation

Follow these steps whenever a user-facing feature is added or changed.

### Step 1: Identify the right section

| Change type                        | Section to update             |
|------------------------------------|-------------------------------|
| New environment variable           | `configuration/environment.mdx` |
| New API endpoint                   | `reference/api.mdx`           |
| New feature (projects, issues...)  | Matching `usage/*.mdx` file   |
| New alert channel                  | `usage/alerts.mdx`            |
| Installation change                | `getting-started/installation.mdx` |
| Known bug / workaround             | `troubleshooting/common-issues.mdx` |

### Step 2: Edit or create the MDX file

If adding a new top-level page:

1. Create the file in the correct `content/<section>/` directory
2. Add the filename key to `content/<section>/_meta.json`

### Step 3: Build and verify

```bash
cd apps/docs
pnpm build
```

The build produces a static export in `out/`. Open `out/index.html` or serve it locally:

```bash
npx serve out
```

### Step 4: Commit

Documentation commits use the `docs:` prefix:

```
docs: add alert webhook configuration guide
docs: update environment variable table for MAX_EVENTS_PER_HOUR
```

### Step 5: Deploy (release)

Documentation is not deployed on every commit. It deploys when a `docs@X.Y.Z` tag is pushed. See the Deployment section below.

---

## 6. Deployment

### Build Process

```bash
cd apps/docs
pnpm build
# Output: out/   (static HTML, CSS, JS)
```

`next.config.js` is configured with:

```js
const nextConfig = {
  output: 'export',          // Static export — no Node.js server needed
  basePath: '/rustrak',      // GitHub Pages serves under /rustrak
  images: { unoptimized: true }, // Required for static export
}
```

### GitHub Actions CI/CD

The workflow file `.github/workflows/docs.yml` triggers on:

```yaml
on:
  push:
    tags:
      - 'docs@*'
```

Steps:

1. Checkout repository
2. Setup pnpm + Node.js
3. `pnpm install --frozen-lockfile`
4. `pnpm --filter docs build`
5. Deploy `apps/docs/out/` to GitHub Pages using `actions/deploy-pages`

### Releasing Documentation

```bash
# Tag a docs release (triggers automatic deployment)
git tag docs@1.2.0
git push origin docs@1.2.0
```

The tag version should reflect the Rustrak version the docs describe, not an independent docs version.

---

## 7. Relationship to Other Parts

The docs app is intentionally decoupled from the server and UI. It does not import any code from `apps/server` or `apps/webview-ui`. It is a pure content site.

| Part            | Relationship                                                          |
|-----------------|-----------------------------------------------------------------------|
| `apps/server`   | Documented here, not imported. Docs describe API contracts and config.|
| `apps/webview-ui` | Documented here, not imported. Docs describe UI workflows.          |
| `packages/client` | Documented here (in `reference/api.mdx`). Not imported.            |
| Monorepo root   | Shares pnpm workspace, Turbo task graph (`docs#build` is standalone). |

### Keeping Docs in Sync

The rule is: **any change that affects user-facing behavior must be reflected in docs before or in the same PR that ships the feature.** This includes:

- New or changed environment variables
- New API endpoints or changed response shapes
- New UI routes or settings pages
- Changed default values
- New alert channels or conditions
- Breaking changes (always documented in `troubleshooting/common-issues.mdx`)
