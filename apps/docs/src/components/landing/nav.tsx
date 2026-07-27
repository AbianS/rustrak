'use client';

import { X } from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from 'motion/react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { GithubIcon } from '@/components/icons/github';
import { RustrakLogoIcon } from '@/components/icons/rustrak-logo';
import { cn } from '@/lib/utils';
import { DUR, EASE, STAGGER } from './motion';
import { HANDHELD, useMediaQuery } from './use-media-query';
import { useStarted } from './use-started';

/** The bar drops in as one piece, then its contents arrive left to right. */
const BAR_VARIANTS = {
  hidden: { y: -72, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: DUR.slow,
      ease: EASE,
      delay: 0.5,
      staggerChildren: STAGGER,
      delayChildren: 0.75,
    },
  },
};

const ITEM_VARIANTS = {
  hidden: { y: -12, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: DUR.base, ease: EASE } },
};

const LINKS = [
  { href: '/getting-started/overview', label: 'Docs' },
  { href: '/changelog', label: 'Changelog' },
  { href: '/blog', label: 'Blog' },
] as const;

const REPO = 'https://github.com/AbianS/rustrak';

/**
 * ── The bar gets out of the way on a phone ──────────────────────────────────
 *
 * A fixed 64px bar is a fifth of a phone's screen height, and this page spends
 * most of itself asking the reader to look at something large: a pinned drawing
 * that opens, a painting held behind a claim, product screens recreated at
 * their real measurements. Holding a permanent strip of chrome over all of it
 * costs more here than the navigation is worth mid-page — nobody scrolling
 * through the engine section wants the menu, and the moment they do want it the
 * gesture they reach for is a scroll back up.
 *
 * So below `md` the bar tucks away as you go down and comes back as you come
 * up. It is not hidden on desktop: there the same 64px is a fifteenth of the
 * screen, and a bar that appears and disappears under a mouse wheel is a
 * flicker rather than a courtesy.
 */

/**
 * Above this scroll position the bar is simply always there.
 *
 * The top of the page is the one place the reader has not yet decided to go
 * anywhere, and a bar that vanishes on the first flick of the hero reads as a
 * glitch. It is also what guarantees a way back: scroll to the top by any means
 * and the navigation is present, without having to know the gesture.
 */
const NAV_ALWAYS_ABOVE = 140;

/**
 * How far the page has to move in one direction before the bar reacts.
 *
 * Both are the bar's own height or a little under, and they are separate
 * numbers on purpose: hiding should take a committed downward scroll, and
 * revealing should be easier than hiding, because a reader scrolling up is
 * usually looking for something and a reader scrolling down is not.
 *
 * Some threshold is not optional. Driving this off the sign of a single frame's
 * delta means momentum scrolling, a rubber-band at the end of the page, and the
 * one-pixel corrections a thumb makes all toggle the bar — which does not read
 * as responsive, it reads as broken.
 */
const NAV_HIDE_AFTER = 72;
const NAV_SHOW_AFTER = 48;

export function LandingNav() {
  const { scrollY } = useScroll();
  const started = useStarted();
  const handheld = useMediaQuery(HANDHELD);
  const [lifted, setLifted] = useState(false);
  const [tucked, setTucked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  /*
    The overlay is still painted for the length of its fade after `menuOpen`
    has gone false, and two things have to be held against *that* rather than
    against the flag: the scroll lock, and nothing else.

    Released on the click instead, a swipe during the fade scrolls the landing
    behind a menu that is still covering it, and the reader is put somewhere
    they never chose to be by a surface they had just dismissed.
  */
  const [menuShowing, setMenuShowing] = useState(false);

  /* The two ends of the keyboard's journey through the menu: the control it is
     opened from, which is where focus has to come back to, and the panel it
     must not leave while that panel is up. */
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuPanel = useRef<HTMLDivElement>(null);

  const openMenu = () => {
    setMenuOpen(true);
    setMenuShowing(true);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    /* Whatever had focus inside the overlay is about to unmount, and focus
       follows an unmounted element to `document.body` — which is no position
       at all, and leaves the next Tab starting again from the top of the page.
       Put back on the control the menu was opened from, closing returns the
       keyboard exactly where opening took it from. */
    menuButton.current?.focus();
  };

  /*
    Distance travelled since the last change of direction, and the position it
    was last measured at.

    Refs rather than state because these move on every scrolled frame and
    nothing renders from them. What renders is `tucked`, which changes a handful
    of times in a whole visit — and `setState` with an unchanged value is a
    no-op, so calling it per frame costs a comparison.
  */
  const at = useRef(0);
  const run = useRef(0);

  // Reading the motion value beats a scroll listener plus state: the value is
  // already being tracked for the scrubs, and this only re-renders on the
  // single frame a threshold is crossed.
  useMotionValueEvent(scrollY, 'change', (value) => {
    setLifted(value > 24);

    const delta = value - at.current;
    at.current = value;
    if (delta === 0) return;

    if (value <= NAV_ALWAYS_ABOVE) {
      run.current = 0;
      setTucked(false);
      return;
    }

    // A change of direction starts the count again, which is what makes the
    // thresholds mean "travelled this far up" rather than "ended up this far
    // from wherever the last event happened to be".
    if (delta > 0 !== run.current > 0) run.current = 0;
    run.current += delta;

    if (run.current > NAV_HIDE_AFTER) setTucked(true);
    else if (run.current < -NAV_SHOW_AFTER) setTucked(false);
  });

  /* The bar is what the menu is closed back onto. Tucked underneath it, the
     overlay would shut onto nothing and the reader would be left with no way
     to open it again short of scrolling. */
  useEffect(() => {
    if (menuOpen) setTucked(false);
  }, [menuOpen]);

  const away = handheld && tucked && !menuOpen;

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
    if (!menuOpen && !menuShowing) return;

    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';

    return () => {
      root.style.overflow = previous;
    };
  }, [menuOpen, menuShowing]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
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

        Queried on the keystroke rather than cached on open: it is five
        elements once every few seconds, and a list cached across an animation
        is a list that can go stale.
      */
      const focusable = menuPanel.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!menuPanel.current?.contains(active)) {
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
  }, [menuOpen]);

  return (
    <>
      {/*
        Three elements, one transform each, and that separation is the reason
        this is not one.

        The entrance is authored as variants on the header, and the parent
        variant is what staggers the contents in. Putting the tuck on the same
        element would mean re-entering the `visible` variant every time the bar
        came back — re-running the child stagger, and re-running it against
        whatever the entrance was doing if the reader scrolled during the first
        second of the page. A separate layer for the tuck cannot collide with
        any of that, and the outer box is what stays fixed while both of them
        move inside it.
      */}
      <div
        className="fixed inset-x-0 top-0 z-40"
        /* A tucked bar is off screen but its links are still in the tab order,
           and focusing something above the viewport is a dead end. Cheaper and
           kinder than `inert`: reaching for it brings it back. */
        onFocusCapture={() => setTucked(false)}
      >
        <motion.div
          animate={{ y: away ? '-102%' : '0%' }}
          /* Just past 100%, so the border under the bar clears the top edge
             instead of leaving a hairline stuck to it. */
          transition={{ duration: DUR.base, ease: EASE }}
        >
          <motion.header
            initial="hidden"
            animate={started ? 'visible' : 'hidden'}
            variants={BAR_VARIANTS}
            className={cn(
              'transition-colors duration-300',
              lifted
                ? 'border-b border-white/8 bg-[oklch(0.14_0_0)]/72 backdrop-blur-xl'
                : 'border-b border-transparent',
            )}
          >
            <nav className="mx-auto flex h-16 max-w-360 items-center justify-between px-5 sm:px-6 md:px-10">
              <motion.div variants={ITEM_VARIANTS}>
                <Link
                  href="/"
                  className="flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                >
                  <RustrakLogoIcon className="size-6" />
                  <span className="text-[13px] font-semibold uppercase tracking-[0.16em]">
                    Rustrak
                  </span>
                </Link>
              </motion.div>

              <div className="hidden items-center gap-8 md:flex">
                {LINKS.map((link) => (
                  <motion.div key={link.href} variants={ITEM_VARIANTS}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-white/55 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))}
                <motion.div variants={ITEM_VARIANTS}>
                  <Link
                    href={REPO}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[13px] text-white/55 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                  >
                    <GithubIcon className="size-3.5" />
                    GitHub
                  </Link>
                </motion.div>
                <motion.div variants={ITEM_VARIANTS}>
                  <Link
                    href="/getting-started/installation"
                    className="rounded-full bg-white px-4 py-1.5 text-[13px] font-medium text-black transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                  >
                    Get started
                  </Link>
                </motion.div>
              </div>

              {/* Pulled out into its own margin so the 44px hit area a thumb needs
              does not push the bar's contents apart to get it. */}
              <motion.button
                ref={menuButton}
                variants={ITEM_VARIANTS}
                type="button"
                onClick={openMenu}
                aria-label="Open menu"
                aria-expanded={menuOpen}
                className="-mr-3 flex flex-col items-center gap-[5px] p-3 md:hidden"
              >
                <span className="block h-px w-5 bg-white" />
                <span className="block h-px w-5 bg-white" />
              </motion.button>
            </nav>
          </motion.header>
        </motion.div>
      </div>

      {/* Wrapped so closing is a fade rather than a cut. Opening was already
          animated and closing was not, which read as the menu breaking rather
          than as it going away. `h-dvh` rather than `inset-0` so the panel is
          the height the browser is actually showing, mid-toolbar-collapse
          included — otherwise the button at the bottom sits under the chrome. */}
      <AnimatePresence onExitComplete={() => setMenuShowing(false)}>
        {menuOpen ? (
          <motion.div
            ref={menuPanel}
            /* Named as what it is. A full-screen surface that takes the
               keyboard and holds it is a dialog whatever it is drawn as, and
               saying so is what tells a screen reader the page behind it is
               not currently the subject. */
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.fast, ease: EASE }}
            className="fixed inset-x-0 top-0 z-50 flex h-dvh flex-col bg-[oklch(0.14_0_0)] md:hidden"
          >
            <div className="flex h-16 shrink-0 items-center justify-between px-5">
              <span className="text-[13px] font-semibold uppercase tracking-[0.16em]">
                Rustrak
              </span>
              <button
                type="button"
                onClick={closeMenu}
                aria-label="Close menu"
                className="-mr-3 p-3"
                // Where the keyboard is put on open. The trap above is what
                // keeps it here; this is only what starts it in the right
                // place, and being first in the panel it is also what Tab
                // wraps back around to.
                // biome-ignore lint/a11y/noAutofocus: modal entry point
                autoFocus
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex flex-1 flex-col justify-center gap-1 px-5 pb-20">
              {[...LINKS, { href: REPO, label: 'GitHub' }].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="display-md py-3 text-white/90"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/getting-started/installation"
                onClick={() => setMenuOpen(false)}
                className="mt-8 rounded-full bg-white px-6 py-3.5 text-center text-[15px] font-medium text-black"
              >
                Get started
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
