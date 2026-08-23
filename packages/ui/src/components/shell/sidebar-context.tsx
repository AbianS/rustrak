'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useMobileBreakpoint } from '../../lib/use-mobile';

interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggle: () => void;
  /**
   * On a phone the sidebar does not collapse to a rail: it leaves the screen
   * and comes back as a drawer over the content. Two different states, on
   * purpose.
   *
   * Collapsing is a preference and is remembered between sessions; opening the
   * drawer is a gesture from one second ago and is never remembered -- opening
   * the app on a phone to find the navigation covering the page would be
   * absurd.
   */
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
  /** True while the breakpoint is being crossed, so nothing animates. */
  switching: boolean;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

/** Whether the key went to something that is typed into. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);

  if (context == null) {
    throw new Error(
      'Sidebar pieces have to live inside <AppShell> or <SidebarProvider>.',
    );
  }

  return context;
}

export interface SidebarProviderProps {
  children: ReactNode;
  /** Governed from outside, for instance to remember it between sessions. */
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /**
   * The shortcut that collapses and expands. `false` turns it off.
   * @default 'b' with Cmd or Ctrl
   */
  shortcutKey?: string | false;
}

/**
 * The sidebar's state.
 *
 * It lives in a context rather than in props because widely separated pieces
 * ask for it: the sidebar to know its width, every row to know whether it draws
 * a label or just an icon, and the footer to draw the right button. Threading
 * it by hand through five levels would be worse.
 */
export function SidebarProvider({
  children,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  shortcutKey = 'b',
}: SidebarProviderProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { mobile, switching } = useMobileBreakpoint();

  /*
   * There is no rail on a phone. The sidebar is either all there or not there
   * at all, so the collapse preference is ignored while it is being looked at
   * from a phone: otherwise the drawer would open showing seven unlabelled
   * icons inside its 216 px.
   *
   * The preference is kept apart from the value it produces because the mask
   * is not the state. Toggling from `collapsed` on a narrow viewport would
   * read `false` every time and so write `true` every time, and the rail would
   * come back on its own the moment the window widened.
   */
  const preference = collapsedProp ?? uncontrolled;
  const collapsed = preference && !mobile;

  const setCollapsed = useCallback(
    (next: boolean) => {
      if (collapsedProp == null) {
        setUncontrolled(next);
      }
      onCollapsedChange?.(next);
    },
    [collapsedProp, onCollapsedChange],
  );

  const toggle = useCallback(
    () => setCollapsed(!preference),
    [preference, setCollapsed],
  );

  const toggleDrawer = useCallback(() => setDrawerOpen((open) => !open), []);

  /* Widen the window and the drawer stops existing: without closing it here,
     narrowing it again would bring it back open with nobody having asked. */
  useEffect(() => {
    if (!mobile) {
      setDrawerOpen(false);
    }
  }, [mobile]);

  useEffect(() => {
    if (shortcutKey === false) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key.toLowerCase() !== shortcutKey ||
        !(event.metaKey || event.ctrlKey)
      ) {
        return;
      }

      /* The listener is on the document, so it also sees the shortcut typed
         into a field. Inside a text control ⌘B belongs to the text -- it is
         bold in a rich editor -- and stealing it there would both move the
         sidebar and swallow the edit. */
      if (isEditable(event.target)) {
        return;
      }

      event.preventDefault();
      toggle();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [shortcutKey, toggle]);

  const value = useMemo(
    () => ({
      collapsed,
      setCollapsed,
      toggle,
      drawerOpen,
      setDrawerOpen,
      toggleDrawer,
      switching,
    }),
    [collapsed, setCollapsed, toggle, drawerOpen, toggleDrawer, switching],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}
