'use client';

import {
  AlertCircle,
  Bot,
  ChevronsLeft,
  ChevronsUpDown,
  LayoutDashboard,
  Menu,
  Rocket,
  ScrollText,
  Settings,
  Zap,
} from 'lucide-react';
import { createContext, type ReactNode, useContext } from 'react';
import { RustrakLogoIcon } from '@/components/icons/rustrak-logo';
import { cn } from '@/lib/utils';
import { useCompact } from './design';
import { Sheen } from './stage';

/**
 * The application chrome, recreated from apps/webview-ui.
 *
 * Three pieces, in the order the real app stacks them: a global header across
 * the full width (`(main)/header.tsx`, h-16, sticky, blurred), a project rail
 * beneath it (`projects/[id]/project-sidebar.tsx`, offset by exactly that
 * header height), and the page. Keeping the chrome in one component is what
 * makes the four screens read as one application being navigated rather than
 * as four unrelated pictures — and holding it to the real measurements is what
 * makes the landing an honest preview instead of an idealised one.
 *
 * Everything is authored at the app's own pixel sizes; `AppFrame` scales the
 * whole thing down to fit. Nothing here is a landing-sized approximation of a
 * product control.
 *
 * In the frame's narrow design (`useCompact`) the rail collapses to the
 * hamburger the real app shows at that width, and the 32px gutters come in to
 * 20px. Those 256 + 24 pixels are the difference between the page column
 * getting 560px to work with and getting 280 — everything else about the
 * narrow layout follows from buying them back.
 */

/**
 * Whether the surrounding surface draws the application chrome.
 *
 * The platform section shows the full application exactly once, in its first
 * chapter, and then stops. Every chapter after it shows one surface on its own:
 * the waterfall, the log stream, the stack trace. The reason is space rather
 * than taste. The rail is 256 real pixels and the header is 64, and a chapter
 * that keeps both has to shrink the surface to make room for chrome the reader
 * has already been shown once and understood.
 *
 * So the second chapter onwards drops it. The claim "this is a real
 * application" is made once, with the whole shell, at the point where the
 * reader has no reason yet to believe it. After that the surfaces can be drawn
 * at 1:1 (see `primitives/bleed.tsx`) and the reader supplies the rail from
 * memory, which is what a reader does with any interface they have seen the
 * shape of.
 *
 * A context rather than a prop because the shell sits three or four components
 * below the section that decides this, and threading a boolean through
 * `MockLogs` and `MockIssueDetail` would put a layout decision in the signature
 * of screens that have no opinion about it. `useCompact` is the same shape for
 * the same reason.
 */
const ChromeContext = createContext(true);

/** Renders its children with no header and no rail. */
export function Bare({ children }: { children: ReactNode }) {
  return (
    <ChromeContext.Provider value={false}>{children}</ChromeContext.Provider>
  );
}

/** The page gutter, wide design and narrow. Used by every screen. */
export const PAD = 'px-8';
export const PAD_COMPACT = 'px-5';

/** `px-8` in the wide design, `px-5` in the narrow one. */
export function usePad(): string {
  return useCompact() ? PAD_COMPACT : PAD;
}

/** Mirrors `navItems` in project-sidebar.tsx, in the same order. */
const NAV = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Issues', icon: AlertCircle },
  { label: 'Releases', icon: Rocket },
  { label: 'Performance', icon: Zap },
  { label: 'Agents', icon: Bot },
  { label: 'Logs', icon: ScrollText },
  { label: 'Settings', icon: Settings },
] as const;

export type NavLabel = (typeof NAV)[number]['label'];

/**
 * Stand-in for `<PlatformIcon platform="node" />` from `platformicons`, which
 * the docs app does not depend on. Same 32px rounded tile, same Node mark.
 */
function NodePlatformIcon({ size = 32 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-md bg-[#3C873A]"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.62}
        height={size * 0.62}
        fill="none"
        aria-hidden
      >
        <path
          d="M12 2.5 20.5 7.2v9.6L12 21.5 3.5 16.8V7.2L12 2.5Z"
          stroke="white"
          strokeOpacity="0.9"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M9.6 9.4v5.1c0 .6-.5 1-1.1 1"
          stroke="white"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M15.6 10.2c-.3-.6-1-.9-1.9-.9-1.2 0-1.9.5-1.9 1.3 0 1.9 4 .8 4 2.9 0 .9-.8 1.5-2.1 1.5-1.1 0-1.9-.4-2.2-1"
          stroke="white"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/**
 * The page's own header strip: every route in the app opens with one of these,
 * a bordered band above the scrolling body.
 */
export function MockPageHead({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const pad = usePad();

  return (
    <div
      className={cn(
        'flex shrink-0 items-start justify-between gap-4 border-b border-border py-5',
        pad,
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="truncate text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}

export function MockShell({
  active,
  children,
}: {
  active: NavLabel;
  children: ReactNode;
}) {
  const compact = useCompact();
  const chrome = useContext(ChromeContext);

  // No header, no rail, no sheen: a bare surface is not pretending to be a
  // window, so light falling across it would be light falling across nothing.
  if (!chrome) {
    return (
      <div className="flex h-full w-full flex-col bg-background text-foreground">
        {children}
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      {/* The panel's idle: light crossing the surface, every fifteen seconds or
          so. Sits above the chrome and below nothing, so it reads as falling on
          the screen rather than as an element inside the app. */}
      <Sheen className="z-20" />

      {/* Global header — full width, above the rail, exactly as in
          (main)/layout.tsx.

          The real app's header is translucent over a blur, because in the real
          app the page scrolls underneath it. Here it does not: this is a flex
          item in a column, so what sits behind it is the frame's own background
          and nothing else. The blur was compositing a layer to reveal a colour
          it already was.

          It was not free, either. `backdrop-filter` inside a `transform`ed
          subtree is one of the more expensive things a compositor can be asked
          for, and `AppFrame` scales every one of these — so the page was
          carrying five of them to produce no visible difference whatsoever. */}
      <header
        className={cn(
          'flex h-16 shrink-0 items-center justify-between border-b border-border bg-background',
          compact ? PAD_COMPACT : PAD,
        )}
      >
        <div className="flex items-center gap-2">
          {/* The rail is gone at this width, so the control that would open it
              takes its place — which is what the real app does, rather than
              leaving the navigation unreachable. */}
          {compact ? (
            <Menu className="mr-1 size-5 text-muted-foreground" />
          ) : null}
          <RustrakLogoIcon className="size-6" />
          <span className="text-sm font-extrabold uppercase tracking-tight">
            Rustrak
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* The project switcher moves into the header once the rail that
              normally carries it is gone. */}
          {compact ? (
            <span className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 py-1 pl-1 pr-2">
              <NodePlatformIcon size={22} />
              <span className="text-xs font-semibold">checkout-api</span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            </span>
          ) : null}
          <span className="grid size-8 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary">
            A
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {compact ? null : (
          <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            {/* Project switcher */}
            <div className="p-2">
              <div className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-2 text-left">
                <NodePlatformIcon />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold leading-tight">
                    checkout-api
                  </span>
                  <span className="truncate font-mono text-xs leading-tight text-muted-foreground">
                    checkout-api
                  </span>
                </div>
                <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
              </div>
            </div>

            <div className="flex-1 py-1">
              <div className="px-2">
                <div className="flex h-8 items-center px-2 text-xs font-medium text-sidebar-foreground/70">
                  Navigation
                </div>
                <nav className="flex flex-col gap-1.5">
                  {NAV.map((item) => {
                    const isActive = item.label === active;
                    return (
                      <span
                        key={item.label}
                        className={cn(
                          'flex h-10 items-center gap-3 rounded-lg px-2 text-[0.925rem] font-medium',
                          // The brand-green fill on the current section is the
                          // single loudest thing in the app's chrome; a subtle
                          // grey highlight here would misrepresent it.
                          isActive
                            ? 'bg-primary font-semibold text-primary-foreground shadow-sm'
                            : 'text-muted-foreground',
                        )}
                      >
                        <item.icon className="size-4 shrink-0" />
                        {item.label}
                      </span>
                    );
                  })}
                </nav>
              </div>
            </div>

            <div className="p-2">
              <span className="flex h-9 items-center justify-center gap-2 rounded-md text-[0.925rem] font-medium text-muted-foreground">
                <ChevronsLeft className="size-4" />
                Collapse
              </span>
            </div>
          </aside>
        )}

        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}

/**
 * `Card size="sm"` from apps/webview-ui/src/components/ui/card.tsx.
 *
 * A ring rather than a border: the app's cards are defined by `ring-1
 * ring-foreground/10` over `bg-card`, which sits fractionally inside the
 * rounded corner and reads softer than a 1px border at the same opacity.
 */
export function MockCard({
  title,
  subtitle,
  action,
  children,
  className,
  contentClassName,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground shadow-xs ring-1 ring-foreground/10',
        className,
      )}
    >
      {title ? (
        <div className="flex items-start justify-between gap-2 px-4">
          <div className="min-w-0">
            {/* The app's tile label: bold, uppercase, widely tracked — and set
                in the sans, not the mono. */}
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {title}
            </p>
            {subtitle ? (
              <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={cn('min-h-0 px-4', contentClassName)}>{children}</div>
    </div>
  );
}

const LEVEL_STYLES = {
  fatal: 'bg-red-500/10 text-red-400',
  error: 'bg-red-500/10 text-red-400',
  warning: 'bg-amber-500/10 text-amber-400',
  warn: 'bg-amber-500/10 text-amber-400',
  info: 'bg-sky-500/10 text-sky-400',
  debug: 'bg-muted text-muted-foreground',
  trace: 'bg-muted text-muted-foreground',
} as const;

export type Level = keyof typeof LEVEL_STYLES;

/** `LevelBadge` from components/issue-indicators.tsx — a full pill, not a tag. */
export function MockLevel({
  level,
  className,
}: {
  level: Level;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide',
        LEVEL_STYLES[level],
        className,
      )}
    >
      {level}
    </span>
  );
}

/**
 * The `Pill` behind `StatusIndicator` and `PriorityIndicator`: a leading colour
 * dot on a muted surface. Status and priority are deliberately quiet in the
 * app — colour is a signal, not the dominant element — so they never get the
 * saturated treatment the severity badge gets.
 */
export function MockPill({
  dot,
  label,
  className,
}: {
  dot: string;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground/80',
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', dot)} />
      {label}
    </span>
  );
}

/** The app's `Button` at `size="sm"`, in the two variants these screens use. */
export function MockButton({
  variant = 'outline',
  className,
  children,
}: {
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium',
        variant === 'default' && 'bg-primary text-primary-foreground shadow-xs',
        variant === 'outline' &&
          'border border-border bg-background text-foreground shadow-xs',
        variant === 'ghost' && 'text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The app's `Badge variant="secondary" | "outline"`. */
export function MockBadge({
  variant = 'secondary',
  className,
  children,
}: {
  variant?: 'secondary' | 'outline';
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium',
        variant === 'secondary'
          ? 'bg-secondary text-secondary-foreground'
          : 'border border-border text-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Column heading in every table the app draws. */
export function MockTh({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'text-xs font-bold uppercase tracking-widest text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}
