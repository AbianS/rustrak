'use client';

import { X } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import Link from 'next/link';
import type { RefObject } from 'react';
import { DUR, EASE } from '../motion';
import { LINKS, REPO } from './links';

/**
 * The full-screen menu a phone gets instead of the bar's links.
 *
 * Owns no state: whether it is open, whether it is still fading, and where
 * focus goes when it leaves all belong to `useMobileMenu`, because the scroll
 * lock and the focus trap outlive this component's own mount.
 */
export function MobileMenu({
  open,
  panelRef,
  onClose,
  onGone,
}: {
  open: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onGone: () => void;
}) {
  /*
    Wrapped so closing is a fade rather than a cut. Opening was already
    animated and closing was not, which read as the menu breaking rather than
    as it going away. `h-dvh` rather than `inset-0` so the panel is the
    height the browser is actually showing, mid-toolbar-collapse included —
    otherwise the button at the bottom sits under the chrome.
  */
  return (
    <AnimatePresence onExitComplete={onGone}>
      {open ? (
        <m.div
          ref={panelRef}
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
              onClick={onClose}
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
                onClick={() => onClose()}
                className="display-md py-3 text-white/90"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/getting-started/installation"
              onClick={() => onClose()}
              className="mt-8 rounded-full bg-white px-6 py-3.5 text-center text-[15px] font-medium text-black"
            >
              Get started
            </Link>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
