'use client';

import { type ReactNode, useEffect } from 'react';
import { cn } from '../../lib/cn';
import { TooltipProvider } from '../tooltip/tooltip';
import {
  SidebarProvider,
  type SidebarProviderProps,
  useSidebar,
} from './sidebar-context';

export interface AppShellProps
  extends Omit<SidebarProviderProps, 'children' | 'shortcutKey'> {
  topbar: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
  className?: string;
  /** The shortcut that collapses the sidebar. `false` turns it off. */
  collapseShortcut?: string | false;
}

/**
 * The application frame: topbar across the top, sidebar and content below it.
 *
 * It occupies exactly the window and the only thing that scrolls is the
 * content. An error tracker is a place you spend the day jumping between a list
 * and a record, and having the navigation scroll away while you read down a
 * thousand events means scrolling back up to leave.
 *
 * `h-dvh` and not `h-screen`: on a phone the browser chrome appears and
 * disappears as you scroll, and with `vh` the last row of a list sits
 * permanently underneath it.
 *
 * It brings the tooltip provider with it, because the collapsed sidebar depends
 * on it: without a provider, running down a rail of seven icons means waiting
 * out the full delay seven times.
 */
export function AppShell({
  topbar,
  sidebar,
  children,
  className,
  collapseShortcut = 'b',
  ...sidebarState
}: AppShellProps) {
  return (
    <TooltipProvider>
      <SidebarProvider shortcutKey={collapseShortcut} {...sidebarState}>
        <div
          className={cn(
            'flex h-dvh flex-col overflow-hidden bg-canvas text-fg',
            className,
          )}
        >
          {topbar}

          <div className="relative flex min-h-0 flex-1">
            {sidebar}
            <DrawerScrim />

            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}

AppShell.displayName = 'AppShell';

/**
 * The dimmed backdrop behind the navigation drawer, on phones only.
 *
 * It does two jobs and both are needed: it dims the content so the navigation
 * reads as being on top of it, and it is the way out -- a tap outside closes,
 * which is what everyone tries before hunting for a cross. Escape does the same
 * for anyone on a keyboard.
 */
function DrawerScrim() {
  const { drawerOpen, setDrawerOpen } = useSidebar();

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, setDrawerOpen]);

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      onClick={() => setDrawerOpen(false)}
      data-open={drawerOpen || undefined}
      className={cn(
        'absolute inset-0 z-30 bg-scrim md:hidden',
        'transition-opacity duration-slow ease-standard',
        'not-data-open:pointer-events-none not-data-open:opacity-0',
      )}
    />
  );
}

export interface PageProps {
  children: ReactNode;
  className?: string;
  /**
   * The page scrolls as one. Off for a screen that owns its own scrolling --
   * a list with a sticky header and a pinned footer -- which is most of them.
   */
  scroll?: boolean;
}

/**
 * A page's content, with the system's 28 px gutter.
 *
 * When it scrolls it also takes focus, and that is not decoration: a logs
 * screen is sixty lines of text with nothing clickable in it, and a scrollable
 * box with no focusable content inside is unreachable with a keyboard --
 * there is literally no way to page down it. The cost is one extra tab stop
 * ahead of the content on pages that do have controls, which is the trade the
 * rule asks for and the one every code viewer makes.
 */
export function Page({ children, className, scroll = true }: PageProps) {
  return (
    <div
      tabIndex={scroll ? 0 : undefined}
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-4 p-page-gutter outline-none',
        scroll ? 'overflow-y-auto' : 'overflow-hidden',
        className,
      )}
    >
      {children}
    </div>
  );
}

Page.displayName = 'Page';

export interface PageHeaderProps {
  title: ReactNode;
  /** One line under the title: what it is made of, in mono. */
  meta?: ReactNode;
  /** Pushed to the right and aligned with the title's baseline block. */
  actions?: ReactNode;
  className?: string;
}

/** A page's heading row: the title, what it is made of, and its actions. */
export function PageHeader({
  title,
  meta,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn('flex shrink-0 items-end justify-between gap-6', className)}
    >
      <div className="min-w-0">
        <h1 className="truncate text-page-title text-fg">{title}</h1>
        {meta ? <div className="mt-1.5 min-w-0">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

PageHeader.displayName = 'PageHeader';

export interface SubHeaderProps {
  /** Usually the breadcrumb trail. */
  children: ReactNode;
  /** Pushed right: record pagination, a counter. */
  actions?: ReactNode;
  className?: string;
}

/**
 * The 42 px strip between the topbar and the page: where you are on the left,
 * how to step through records on the right.
 *
 * It only exists on a record screen. On a list the page title already says
 * where you are, and a trail that reads "Issues / Issues" is noise.
 */
export function SubHeader({ children, actions, className }: SubHeaderProps) {
  return (
    <div
      className={cn(
        'flex h-subheader shrink-0 items-center justify-between gap-4',
        'border-b border-border-subtle px-page-gutter',
        className,
      )}
    >
      {children}
      {actions ? (
        <div className="flex shrink-0 items-center gap-2.5">{actions}</div>
      ) : null}
    </div>
  );
}

SubHeader.displayName = 'SubHeader';
