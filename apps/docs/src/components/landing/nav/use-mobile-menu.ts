'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The mobile menu's lifecycle, which is longer than "is it open".
 *
 * `open` is the reader's intent; `showing` is whether the overlay is still on
 * the screen, fade included. They differ for exactly the length of the exit
 * animation, and almost everything here cares about the second one: the page
 * is still covered while it fades, so the scroll lock and the focus trap have
 * to outlive the dismissal.
 */
export function useMobileMenu() {
  const [open, setOpen] = useState(false);
  const [showing, setShowing] = useState(false);

  /* The two ends of the keyboard's journey through the menu: the control it is
     opened from, which is where focus has to come back to, and the panel it
     must not leave while that panel is up. */
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const openMenu = () => {
    setOpen(true);
    setShowing(true);
  };

  const closeMenu = () => setOpen(false);

  /*
    Focus goes home when the panel is actually gone, not when it is dismissed.

    Both halves of this were got wrong once. Left alone, focus follows the
    unmounting close button to `document.body`, which is no position at all and
    starts the next Tab from the top of the page. Handed straight back on the
    click instead, it lands on a trigger that is still underneath an opaque
    overlay for the rest of the fade — a focus ring nobody can see, on the one
    layer the reader is not looking at.

    Waiting for the exit resolves both. Through the fade the keyboard stays on
    the close button, which is inside the panel and still visible while it
    dissolves, and the trap below goes on doing its ordinary job. The moment
    the overlay is gone the trigger is uncovered, and that is when it is worth
    focusing. Reopening mid-fade cancels the exit and never fires this, which
    is the correct answer to that too.
  */
  const onGone = () => {
    setShowing(false);
    buttonRef.current?.focus();
  };

  /*
    The overlay is `position: fixed`, which stops it moving but does nothing
    to stop the page *under* it — a swipe anywhere on the menu scrolled the
    landing behind it, and closing put you somewhere you had never chosen to
    be. Locked on the root element rather than on `body` so it holds on iOS
    Safari, which honours `overflow: hidden` on one and not reliably on the
    other.

    Held for as long as the overlay is on the screen, fade included.
  */
  useEffect(() => {
    if (!open && !showing) return;

    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';

    return () => {
      root.style.overflow = previous;
    };
  }, [open, showing]);

  useEffect(() => {
    if (!open && !showing) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (open) closeMenu();
        return;
      }

      if (event.key !== 'Tab') return;

      /*
        The trap.

        The bar underneath stays mounted and focusable while the overlay covers
        it, and so does every link on the page below — `position: fixed` and a
        `z-50` are a claim about paint order, not about the tab order. Without
        this, a fourth Tab off the last link walks the keyboard into content
        hidden behind an opaque surface, and the reader loses sight of where
        they are while apparently still looking at a menu.

        Held for as long as the panel is *visible*, dismissed or not, which is
        why it is `showing` above and not `open`: the fade is exactly the
        window in which the page is still covered and nothing was stopping Tab
        from walking underneath it.

        Queried on the keystroke rather than cached on open: it is five
        elements once every few seconds, and a list cached across an animation
        is a list that can go stale.
      */
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!panelRef.current?.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, showing]);

  return { open, showing, buttonRef, panelRef, openMenu, closeMenu, onGone };
}
