# Rustrak WebView UI — Architecture

> **Component**: `apps/webview-ui`
> **Framework**: Next.js 16.1 (App Router)
> **Language**: TypeScript 5.9 strict mode

---

## 1. Executive Summary

The WebView UI is an optional, separately deployable Next.js dashboard for Rustrak. It connects to a running Rustrak server via the `@rustrak/client` package and exposes a full-featured error tracking interface: project management, issue lists, event detail inspection, alert configuration, and account settings.

The UI is architecturally distinct from a typical SPA. Nearly all rendering happens on the server (React Server Components), and all API communication is mediated through Server Actions — never direct client-side fetch calls. This keeps the client bundle small, avoids CORS concerns, and ensures auth cookies are always handled server-side.

---

## 2. Architecture Pattern

### RSC-First (React Server Components)

```
Browser
  │
  │  HTTP GET /projects/123/issues/456
  ▼
Next.js Server (Node.js runtime)
  │
  │  1. Run layout.tsx (auth check)
  │  2. Run page.tsx (Server Component)
  │  3. Call Server Action → @rustrak/client → Rustrak API
  │  4. Render HTML with data
  │  5. Stream to browser
  ▼
Browser displays fully-rendered page
(minimal JS hydration for interactive parts only)
```

**Rules enforced in this codebase:**

1. All components are Server Components by default (no `'use client'` unless required)
2. `'use client'` is only added for components with browser events (onClick, onChange), `useState`, `useEffect`, or `useTransition`
3. API calls happen exclusively in files marked `'use server'`
4. No `fetch()` calls inside client components

---

## 3. Tech Stack

| Concern               | Technology                     | Notes                                              |
|-----------------------|--------------------------------|----------------------------------------------------|
| Framework             | Next.js 16.1 (App Router)      | File-based routing, RSC, Server Actions            |
| Language              | TypeScript 5.9 strict          | `strictNullChecks`, `noUncheckedIndexedAccess`     |
| Styling               | Tailwind CSS 4.1               | Utility-first, no CSS files                        |
| UI primitives         | Radix UI                       | Accessible, headless primitives                    |
| UI patterns           | shadcn/ui                      | Radix + Tailwind composed components               |
| Icons                 | Lucide React                   | Tree-shakable SVG icons                            |
| Theme                 | next-themes                    | Dark / light / system with zero flash              |
| Forms                 | react-hook-form + Zod          | Uncontrolled forms, schema validation              |
| Toasts                | Sonner                         | Server Action feedback, promise toasts             |
| API client            | @rustrak/client (workspace:*)  | Typed, schema-validated HTTP client                |
| Date formatting       | date-fns                       | Tree-shakable, locale-aware                        |
| Syntax highlighting   | react-syntax-highlighter       | Stack trace display                                |
| Dead code detection   | Knip                           | Removes unused exports and files                   |
| Container             | Docker                         | Standalone Next.js output                          |

---

## 4. Authentication Flow

Authentication uses httpOnly session cookies set by the Rustrak server. The UI never handles passwords or tokens in client-side JavaScript.

```
Browser
  │
  │  POST /auth/login  (form submission)
  ▼
Next.js Server Action (`'use server'`)
  │
  │  createClient() → @rustrak/client
  │  client.auth.login({ email, password })
  │                    ↓
  │            Rustrak Server
  │            POST /api/v1/auth/login
  │            Response: Set-Cookie: session=...; HttpOnly; SameSite=Lax
  │
  │  Forward Set-Cookie header to browser
  ▼
Browser stores httpOnly cookie
  │
  │  Every subsequent navigation:
  │  Browser sends cookie automatically
  ▼
Next.js Server Action reads cookie via `cookies()` from next/headers
  │  createClient() attaches cookie to @rustrak/client requests
  │  Rustrak Server validates session
  ▼
```

### Protected Route Group

The `(main)` route group wraps all authenticated pages. Its `layout.tsx` calls `getCurrentUser()` on every render. If no valid session exists, it calls `redirect('/auth/login')`.

```
app/
├── auth/
│   └── login/page.tsx          ← public, no auth check
└── (main)/
    ├── layout.tsx               ← auth guard: getCurrentUser() or redirect
    ├── projects/
    ├── settings/
    └── ...
```

---

## 5. Data Fetching Pattern

### Server Actions

All API calls go through dedicated Server Action files. These are plain TypeScript files with `'use server'` at the top. Next.js compiles them into POST endpoints; client components call them as regular async functions.

```typescript
// app/actions/issues.ts
'use server'

import { createClient } from '@/lib/client'

export async function getIssues(projectId: string, cursor?: string) {
  const client = await createClient()
  return client.issues.list(projectId, { cursor, limit: 25 })
}

export async function resolveIssue(issueId: string) {
  const client = await createClient()
  return client.issues.update(issueId, { status: 'resolved' })
}
```

### createClient() Helper

The `createClient()` function (in `lib/client.ts`) is the single place where:

1. The cookie header is read from `next/headers`
2. The `RUSTRAK_API_URL` environment variable is read
3. The `@rustrak/client` instance is constructed

```typescript
// lib/client.ts
import { cookies } from 'next/headers'
import { RustrakClient } from '@rustrak/client'

export async function createClient() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value

  return new RustrakClient({
    baseUrl: process.env.RUSTRAK_API_URL!,
    headers: sessionCookie
      ? { Cookie: `session=${sessionCookie}` }
      : undefined,
  })
}
```

### useTransition for Mutations

Client components that trigger mutations use `useTransition` to show pending states without losing interactivity:

```typescript
'use client'

const [isPending, startTransition] = useTransition()

function handleResolve() {
  startTransition(async () => {
    await resolveIssue(issueId)
    toast.success('Issue resolved')
  })
}
```

---

## 6. Route Structure

| Route                                              | Purpose                               |
|----------------------------------------------------|---------------------------------------|
| `/`                                                | Redirects to `/projects`              |
| `/auth/login`                                      | Login form (public)                   |
| `/projects`                                        | Project list with cursor pagination   |
| `/projects/[id]`                                   | Project overview + issues list        |
| `/projects/[id]/issues/[issueId]`                  | Redirects to latest event             |
| `/projects/[id]/issues/[issueId]/events/[eventId]` | Event detail (6 tabs)                 |
| `/settings/tokens`                                 | API token management                  |
| `/settings/account`                                | Email + password change               |
| `/settings/appearance`                             | Theme preference (dark/light/system)  |
| `/settings/alerts`                                 | Alert rule configuration              |
| `/settings/about`                                  | Version info, server status           |

---

## 7. Component Architecture

### Server vs Client Boundary

```
app/projects/[id]/issues/page.tsx        ← Server Component
  │  Calls getIssues() Server Action
  │  Passes data as props
  ▼
components/issues/IssueList.tsx          ← Server Component (renders list)
  │
  └── components/issues/IssueRow.tsx     ← Server Component (renders row)
        │
        └── components/issues/IssueActions.tsx  ← Client Component ('use client')
              Handles: resolve, ignore, delete buttons
              Uses: useTransition, toast notifications
```

### Naming Convention

| Pattern               | Convention                                   |
|-----------------------|----------------------------------------------|
| Server Component      | `PascalCase.tsx` (no directive needed)       |
| Client Component      | `PascalCase.tsx` with `'use client'` at top  |
| Server Action file    | `app/actions/<resource>.ts` with `'use server'` |
| Shared UI primitive   | `components/ui/<name>.tsx` (shadcn/ui style) |
| Feature component     | `components/<feature>/<Name>.tsx`            |
| Page                  | `app/(main)/<route>/page.tsx`                |
| Layout                | `app/(main)/<route>/layout.tsx`              |

---

## 8. UI Component Library

Components follow the shadcn/ui pattern: Radix UI primitives wrapped with Tailwind classes, copied into the codebase (not imported from a package). This allows full customization without dependency constraints.

### Core Components (`components/ui/`)

| Component      | Based On              | Usage                                        |
|----------------|-----------------------|----------------------------------------------|
| Button         | Radix Slot            | Actions, form submits                        |
| Input          | HTML input            | Form fields                                  |
| Select         | Radix Select          | Dropdowns, filters                           |
| Dialog         | Radix Dialog          | Modals (token creation, issue deletion)      |
| DropdownMenu   | Radix DropdownMenu    | Action menus on issue rows                   |
| Tabs           | Radix Tabs            | Event detail page tabs                       |
| Badge          | span + Tailwind       | Issue status, event level                    |
| Card           | div + Tailwind        | Content containers                           |
| Skeleton       | div + animate-pulse   | Loading placeholders                         |
| Tooltip        | Radix Tooltip         | Abbreviated timestamps, truncated text       |
| Switch         | Radix Switch          | Toggle settings                              |
| Textarea       | HTML textarea         | Alert message templates                      |

### Theme System

`next-themes` wraps the root layout. The active theme class (`dark` or `light`) is set on `<html>`. Tailwind's `dark:` variant prefix handles all color switching. The user's preference is persisted in `localStorage` and restored without flash via a script injected in `<head>`.

---

## 9. State Management

There is no global client-side state store (no Redux, no Zustand). State is managed at the appropriate layer:

| State Type              | Where It Lives                                     |
|-------------------------|----------------------------------------------------|
| Server data             | Server Components (fetched fresh on each request)  |
| URL state (filters, cursor) | `useSearchParams` + `router.push`              |
| Form state              | `react-hook-form` (uncontrolled)                   |
| UI transient state      | `useState` in Client Components                    |
| Theme preference        | `next-themes` → `localStorage`                     |
| Toast queue             | Sonner's built-in store                            |

This approach means no cache invalidation problems and no stale data bugs. The trade-off is that navigating back to a list re-fetches data — acceptable for an internal dashboard.

---

## 10. Event Detail Tabs

The event detail page (`/projects/[id]/issues/[issueId]/events/[eventId]`) renders six tabs showing different facets of the same event.

| Tab          | Content                                                    |
|--------------|------------------------------------------------------------|
| Stack Trace  | Exception type, value, frames with file/line/function. Syntax-highlighted code context via `react-syntax-highlighter`. |
| Breadcrumbs  | Chronological list of breadcrumbs leading to the error. Type icon, timestamp, message, data object. |
| Details      | Event metadata: timestamp, event ID, platform, SDK version, release, environment, server name, transaction. |
| Tags         | Key-value tag pairs sent by the SDK. Filterable. Clicking a tag links to issue list filtered by that tag. |
| Context      | Runtime context: OS, runtime, browser, device, GPU. Displayed as structured key-value panels. |
| Raw JSON     | Complete raw event payload. Syntax-highlighted JSON via `react-syntax-highlighter`. Copy-to-clipboard button. |

Tab state is persisted in the URL via a `?tab=` search parameter so links to specific tabs work correctly.

---

## 11. Source Structure

```
apps/webview-ui/
├── app/
│   ├── layout.tsx                   # Root layout: ThemeProvider, Toaster
│   ├── page.tsx                     # Redirect to /projects
│   ├── auth/
│   │   └── login/page.tsx           # Login form (public)
│   ├── (main)/
│   │   ├── layout.tsx               # Auth guard + nav shell
│   │   ├── projects/
│   │   │   ├── page.tsx             # Project list
│   │   │   └── [id]/
│   │   │       ├── page.tsx         # Project + issues list
│   │   │       └── issues/
│   │   │           └── [issueId]/
│   │   │               ├── page.tsx # Redirect to latest event
│   │   │               └── events/
│   │   │                   └── [eventId]/page.tsx  # Event detail
│   │   └── settings/
│   │       ├── tokens/page.tsx
│   │       ├── account/page.tsx
│   │       ├── appearance/page.tsx
│   │       ├── alerts/page.tsx
│   │       └── about/page.tsx
│   └── actions/
│       ├── projects.ts              # 'use server' — project CRUD
│       ├── issues.ts                # 'use server' — issue list, update
│       ├── events.ts                # 'use server' — event fetch
│       ├── tokens.ts                # 'use server' — token CRUD
│       └── auth.ts                  # 'use server' — login, logout
├── components/
│   ├── ui/                          # shadcn/ui primitives
│   ├── issues/                      # IssueList, IssueRow, IssueActions
│   ├── events/                      # EventTabs, StackTrace, Breadcrumbs...
│   ├── projects/                    # ProjectCard, ProjectList
│   ├── settings/                    # TokenList, TokenCreateDialog...
│   └── nav/                         # Sidebar, TopBar
├── lib/
│   ├── client.ts                    # createClient() with cookie forwarding
│   └── utils.ts                     # cn() (clsx + tailwind-merge)
├── public/                          # Static assets
├── next.config.ts                   # standalone output, env validation
├── tailwind.config.ts
└── tsconfig.json                    # strict mode, path aliases
```

---

## 12. Environment Variables

| Variable         | Required | Description                                      |
|------------------|----------|--------------------------------------------------|
| `RUSTRAK_API_URL`| Yes      | Base URL of the Rustrak server (e.g. `http://server:8080`) |

The `RUSTRAK_API_URL` is a server-side-only variable (no `NEXT_PUBLIC_` prefix). It is never exposed to the browser.

---

## 13. Deployment

### Docker

```dockerfile
# Stage 1: Dependencies
FROM node:22-alpine AS deps
# Install pnpm, install dependencies

# Stage 2: Build
FROM node:22-alpine AS builder
# pnpm build → .next/standalone

# Stage 3: Runtime
FROM node:22-alpine AS runner
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
CMD ["node", "server.js"]
```

The `standalone` Next.js output bundles only the Node.js files needed to run the server, without `node_modules`. This keeps the image small.

### Required at Runtime

- `RUSTRAK_API_URL` environment variable pointing to the Rustrak server
- Network access to the Rustrak server (same Docker network in compose)

### Docker Compose

In the default `docker-compose.yml`, the webview-ui service has:

```yaml
environment:
  RUSTRAK_API_URL: http://server:8080
depends_on:
  - server
```

The UI runs on port `3000` by default.
