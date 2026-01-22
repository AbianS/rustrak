# Rustrak WebView UI - Technical Context

> **Context Note**: This is the **frontend-specific context** for Rustrak.
> - Root context: `/CLAUDE.md`
> - Server API: `apps/server/CLAUDE.md`
> - Client Package: `packages/client/CLAUDE.md`

## Overview

Next.js 16.1 dashboard for Rustrak error tracking system. Uses App Router with Server Components by default, and shadcn/ui for the component library.

## Tech Stack

- **Framework**: Next.js 16.1 (App Router)
- **Language**: TypeScript 5.9 (strict mode)
- **Styling**: Tailwind CSS 4.1
- **UI Components**: Radix UI + shadcn/ui
- **Theme**: next-themes (dark/light/system)
- **Icons**: Lucide React
- **API Client**: @rustrak/client (internal package)

## Directory Structure

```
apps/webview-ui/
├── CLAUDE.md              # This file
├── Dockerfile             # Production image
├── package.json
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout (ThemeProvider)
│   │   ├── page.tsx           # Root redirect to /projects
│   │   ├── globals.css        # Tailwind + CSS variables
│   │   ├── auth/
│   │   │   └── login/         # Login page
│   │   └── (main)/            # Protected route group
│   │       ├── layout.tsx     # Auth check + Header
│   │       ├── header.tsx     # Navigation header
│   │       ├── projects/      # Projects management
│   │       │   ├── page.tsx
│   │       │   ├── projects-header.tsx
│   │       │   ├── projects-list.tsx
│   │       │   └── [id]/      # Project detail
│   │       │       ├── page.tsx
│   │       │       ├── project-header.tsx
│   │       │       ├── project-settings-dialog.tsx
│   │       │       ├── issues-list.tsx
│   │       │       └── issues/[issueId]/
│   │       │           ├── page.tsx
│   │       │           ├── issue-header.tsx
│   │       │           ├── issue-actions.tsx
│   │       │           ├── events-list.tsx
│   │       │           └── events/[eventId]/
│   │       │               ├── page.tsx
│   │       │               ├── event-navigation.tsx
│   │       │               ├── stack-trace.tsx
│   │       │               ├── breadcrumbs.tsx
│   │       │               ├── event-details.tsx
│   │       │               ├── event-tags.tsx
│   │       │               ├── event-context.tsx
│   │       │               └── raw-json.tsx
│   │       └── settings/      # Settings pages
│   │           ├── layout.tsx
│   │           ├── page.tsx   # Redirect to /settings/tokens
│   │           ├── settings-nav.tsx
│   │           ├── tokens/
│   │           │   ├── page.tsx
│   │           │   └── tokens-list.tsx
│   │           ├── account/
│   │           │   └── page.tsx
│   │           ├── appearance/
│   │           │   ├── page.tsx
│   │           │   └── theme-selector.tsx
│   │           └── about/
│   │               └── page.tsx
│   ├── actions/           # Server Actions
│   │   ├── auth.ts        # login, logout, register, getCurrentUser
│   │   ├── projects.ts    # CRUD operations
│   │   ├── issues.ts      # Issue management
│   │   ├── events.ts      # Event listing and detail
│   │   └── tokens.ts      # API token management
│   ├── components/
│   │   ├── theme-provider.tsx
│   │   ├── theme-toggle.tsx
│   │   └── ui/            # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       ├── badge.tsx
│   │       ├── alert-dialog.tsx
│   │       ├── checkbox.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── textarea.tsx
│   │       ├── tooltip.tsx
│   │       └── form.tsx
│   └── lib/
│       ├── rustrak.ts     # API client factory + cookie utilities
│       └── utils.ts       # cn() helper for classnames
```

## Key Patterns

### 1. Authentication Flow

**Session-based auth with httpOnly cookies:**

```typescript
// src/lib/rustrak.ts
export async function createClient(): Promise<RustrakClient> {
  const cookies = await getCookies();
  return new RustrakClient({
    baseUrl: process.env.RUSTRAK_API_URL ?? 'http://localhost:8080',
    headers: {
      Cookie: cookies.toString(),
    },
  });
}

// src/actions/auth.ts
export async function getCurrentUser(): Promise<User | null> {
  try {
    const client = await createClient();
    return await client.auth.getCurrentUser();
  } catch {
    return null;
  }
}
```

**Protected routes via layout:**

```typescript
// src/app/(main)/layout.tsx
export default async function MainLayout({ children }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }
  return (
    <>
      <Header user={user} />
      <main>{children}</main>
    </>
  );
}
```

### 2. Server Actions Pattern

All API calls go through Server Actions:

```typescript
// src/actions/projects.ts
'use server';

export async function getProjects(options?: ListProjectsOptions) {
  const client = await createClient();
  return client.projects.list(options);
}

export async function deleteProject(id: number): Promise<void> {
  const client = await createClient();
  return client.projects.delete(id);
}
```

### 3. Client Components with useTransition

For interactive UI with pending states:

```typescript
'use client';

export function DeleteButton({ id }: { id: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      await deleteProject(id);
      router.refresh();
    });
  };

  return (
    <Button onClick={handleDelete} disabled={isPending}>
      {isPending ? 'Deleting...' : 'Delete'}
    </Button>
  );
}
```

### 4. Theme Support

**Theme Provider in root layout:**

```typescript
// src/app/layout.tsx
<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
  {children}
</ThemeProvider>
```

**Theme selector in settings:**

```typescript
// Uses next-themes useTheme() hook
const { theme, setTheme } = useTheme();
```

## Routes

| Route | Description |
|-------|-------------|
| `/` | Redirect to `/projects` |
| `/auth/login` | Login form |
| `/projects` | Projects list with pagination |
| `/projects/[id]` | Project detail + issues list |
| `/projects/[id]/issues/[issueId]` | Issue detail (redirects to latest event) |
| `/projects/[id]/issues/[issueId]/events/[eventId]` | Event detail with tabs |
| `/settings` | Redirect to `/settings/tokens` |
| `/settings/tokens` | API token management |
| `/settings/account` | Account info (read-only) |
| `/settings/appearance` | Theme selector |
| `/settings/about` | Version info |

## Event Detail Tabs

The event detail page (`events/[eventId]/page.tsx`) shows:

1. **Stack Trace** - Exception frames with code context
2. **Breadcrumbs** - Timeline of user actions
3. **Event Details** - Metadata (event ID, timestamp, SDK, etc.)
4. **Tags** - Categorized tag display
5. **Context** - Runtime/device/browser info
6. **Raw JSON** - Full event payload

## UI Components

Using shadcn/ui with Radix primitives. Key components:

- **AlertDialog** - Confirmation dialogs (delete actions)
- **Dialog** - Modal dialogs (create token, project settings)
- **DropdownMenu** - Action menus
- **Tabs** - Tab navigation (event detail)
- **Table** - Data tables (projects, issues, tokens)
- **Badge** - Status indicators
- **Card** - Content containers

## Environment Variables

```bash
RUSTRAK_API_URL=http://localhost:8080  # Backend API URL
```

## Development

```bash
# Install dependencies
pnpm install

# Development server
pnpm dev

# Type checking
pnpm tsc --noEmit

# Build
pnpm build
```

## Docker

```bash
# Build image
docker build -t rustrak-ui .

# Run container
docker run -p 3000:3000 -e RUSTRAK_API_URL=http://api:8080 rustrak-ui
```
