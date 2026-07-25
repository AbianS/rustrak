'use client';

import { X } from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from 'motion/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GithubIcon } from '@/components/icons/github';
import { RustrakLogoIcon } from '@/components/icons/rustrak-logo';
import { cn } from '@/lib/utils';
import { DUR, EASE, STAGGER } from './motion';
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

export function LandingNav() {
  const { scrollY } = useScroll();
  const started = useStarted();
  const [lifted, setLifted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Reading the motion value beats a scroll listener plus state: the value is
  // already being tracked for the scrubs, and this only re-renders on the
  // single frame the threshold is crossed.
  useMotionValueEvent(scrollY, 'change', (value) => {
    setLifted(value > 24);
  });

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    /*
      The overlay is `position: fixed`, which stops it moving but does nothing
      to stop the page *under* it — a swipe anywhere on the menu scrolled the
      landing behind it, and closing put you somewhere you had never chosen to
      be. Locked on the root element rather than on `body` so it holds on iOS
      Safari, which honours `overflow: hidden` on one and not reliably on the
      other.
    */
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';

    document.addEventListener('keydown', onKeyDown);
    return () => {
      root.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <>
      <motion.header
        initial="hidden"
        animate={started ? 'visible' : 'hidden'}
        variants={BAR_VARIANTS}
        className={cn(
          'fixed inset-x-0 top-0 z-40 transition-colors duration-300',
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
            variants={ITEM_VARIANTS}
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="-mr-3 flex flex-col items-center gap-[5px] p-3 md:hidden"
          >
            <span className="block h-px w-5 bg-white" />
            <span className="block h-px w-5 bg-white" />
          </motion.button>
        </nav>
      </motion.header>

      {/* Wrapped so closing is a fade rather than a cut. Opening was already
          animated and closing was not, which read as the menu breaking rather
          than as it going away. `h-dvh` rather than `inset-0` so the panel is
          the height the browser is actually showing, mid-toolbar-collapse
          included — otherwise the button at the bottom sits under the chrome. */}
      <AnimatePresence>
        {menuOpen ? (
          <motion.div
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
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="-mr-3 p-3"
                // The overlay is short-lived and has no other interactive
                // content, so moving focus here is enough to keep the keyboard
                // inside it.
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
