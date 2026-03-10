# Component Inventory — WebView UI

> Generated: 2026-03-10 | Scan level: deep | Part: webview-ui

## Overview

The webview-ui uses **shadcn/ui** patterns built on **Radix UI primitives** with Tailwind CSS 4. Components are located in `src/components/ui/` and follow the shadcn/ui conventions (copy-owned, customizable).

**Component count:** ~18 UI primitives + ~30 page-specific components

---

## UI Primitive Components (`src/components/ui/`)

These are reusable, unstyled-to-styled Radix UI wrappers.

| Component | File | Radix Primitive | Used For |
|-----------|------|----------------|---------|
| `Button` | `button.tsx` | None (cva) | All buttons, primary/secondary/destructive variants |
| `Card` | `card.tsx` | None | Content containers (project cards, settings sections) |
| `Dialog` | `dialog.tsx` | `@radix-ui/react-dialog` | Modal dialogs (create token, project settings) |
| `AlertDialog` | `alert-dialog.tsx` | `@radix-ui/react-alert-dialog` | Confirmation modals (delete actions) |
| `DropdownMenu` | `dropdown-menu.tsx` | `@radix-ui/react-dropdown-menu` | Action menus (per-row actions in tables) |
| `Tabs` | `tabs.tsx` | `@radix-ui/react-tabs` | Event detail tab navigation (6 tabs) |
| `Table` | `table.tsx` | None (semantic HTML) | Projects list, issues list, tokens list |
| `Badge` | `badge.tsx` | None (cva) | Issue level indicators (error/warning/info) |
| `Input` | `input.tsx` | None | Form text inputs |
| `Label` | `label.tsx` | `@radix-ui/react-label` | Form labels |
| `Select` | `select.tsx` | `@radix-ui/react-select` | Dropdowns (settings, filters) |
| `Checkbox` | `checkbox.tsx` | `@radix-ui/react-checkbox` | Form checkboxes |
| `Switch` | `switch.tsx` | `@radix-ui/react-switch` | Toggle switches (alert enable/disable) |
| `Separator` | `separator.tsx` | `@radix-ui/react-separator` | Visual dividers |
| `Tooltip` | `tooltip.tsx` | `@radix-ui/react-tooltip` | Hover tooltips |
| `Form` | `form.tsx` | react-hook-form + Radix | Form wrapper with validation messages |

---

## App-Level Components

### Global

| Component | File | Type | Description |
|-----------|------|------|-------------|
| `ThemeProvider` | `components/theme-provider.tsx` | Client | next-themes wrapper, dark/light/system |
| `Toaster` | `components/toaster.tsx` | Client | Sonner toast notifications |

### Layout (`app/(main)/`)

| Component | File | Type | Description |
|-----------|------|------|-------------|
| `Header` | `(main)/header.tsx` | Client | Top navigation bar with user menu |
| `MainLayout` | `(main)/layout.tsx` | Server | Auth guard + header wrapper |
| `SettingsNav` | `settings/settings-nav.tsx` | Client | Left sidebar navigation for settings |

### Projects

| Component | File | Type | Description |
|-----------|------|------|-------------|
| `ProjectsHeader` | `projects/projects-header.tsx` | Client | "New Project" button + create dialog |
| `ProjectsList` | `projects/projects-list.tsx` | Client | Grid of project cards with event counts |
| `ProjectHeader` | `projects/[id]/project-header.tsx` | Client | Project title + DSN display + settings button |
| `ProjectSettingsDialog` | `projects/[id]/project-settings-dialog.tsx` | Client | Edit name/slug + delete project |
| `ProjectAlertsDialog` | `projects/[id]/project-alerts-dialog.tsx` | Client | Manage alert rules for project |
| `IssuesList` | `projects/[id]/issues-list.tsx` | Client | Paginated list of issues with filters |

### Issues

| Component | File | Type | Description |
|-----------|------|------|-------------|
| `IssueActions` | `issues/[issueId]/issue-actions.tsx` | Client | Resolve/Mute/Delete buttons with transitions |

### Events

| Component | File | Type | Description |
|-----------|------|------|-------------|
| `EventNavigation` | `events/[eventId]/event-navigation.tsx` | Client | Prev/Next event navigation |
| `StackTrace` | `events/[eventId]/stack-trace.tsx` | Server | Exception frames with syntax highlighting |
| `Breadcrumbs` | `events/[eventId]/breadcrumbs.tsx` | Server | Timeline of SDK breadcrumbs |
| `EventDetails` | `events/[eventId]/event-details.tsx` | Server | Metadata (ID, timestamp, SDK, platform) |
| `EventTags` | `events/[eventId]/event-tags.tsx` | Server | Key-value tag display |
| `EventContext` | `events/[eventId]/event-context.tsx` | Server | Runtime/device/browser context |
| `RawJson` | `events/[eventId]/raw-json.tsx` | Client | Full raw event JSON viewer |

### Settings

| Component | File | Type | Description |
|-----------|------|------|-------------|
| `TokensList` | `settings/tokens/tokens-list.tsx` | Client | CRUD API tokens |
| `ThemeSelector` | `settings/appearance/theme-selector.tsx` | Client | Light/dark/system selector |
| `AlertChannelsList` | `settings/alerts/alert-channels-list.tsx` | Client | Global notification channels management |

### Auth

| Component | File | Type | Description |
|-----------|------|------|-------------|
| `LoginForm` | `auth/login/login-form.tsx` | Client | Email/password form with react-hook-form + Zod |

---

## Component Patterns

### Server vs Client boundary

```
Server Components (default):
- Page files (page.tsx)
- Layout files (layout.tsx)
- Data display components (StackTrace, Breadcrumbs, EventDetails, EventTags, EventContext)

Client Components ('use client'):
- Forms (LoginForm)
- Interactive lists with mutations (ProjectsList, IssuesList, TokensList)
- Dialogs with state (ProjectSettingsDialog)
- Navigation with useRouter (EventNavigation, IssueActions)
- Theme-related (ThemeProvider, ThemeSelector)
```

### Mutation pattern (Client Components)

```tsx
'use client';

export function DeleteButton({ id }: { id: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      await deleteProject(id);
      router.refresh();  // Re-fetch Server Component data
    });
  };

  return (
    <Button onClick={handleDelete} disabled={isPending} variant="destructive">
      {isPending ? 'Deleting...' : 'Delete'}
    </Button>
  );
}
```

### Toast notifications

```tsx
import { toast } from 'sonner';

// Success
toast.success('Project created');

// Error
toast.error('Failed to delete: ' + error.message);
```

---

## Design System

**Color system:** CSS variables via Tailwind CSS 4 + shadcn/ui conventions
- `--background`, `--foreground`
- `--primary`, `--secondary`, `--destructive`, `--muted`
- `--card`, `--popover`, `--border`

**Dark mode:** Class-based via `next-themes` (`class="dark"` on `<html>`)

**Typography:** System font stack (no custom fonts)

**Icons:** Lucide React (tree-shakeable SVG icons)

**Animations:** `tw-animate-css` for micro-animations

**Utility:** `cn()` helper (clsx + tailwind-merge) for conditional class merging:
```tsx
import { cn } from '@/lib/utils';
<div className={cn('base-class', condition && 'conditional-class')} />
```
