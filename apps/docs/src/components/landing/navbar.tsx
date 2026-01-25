'use client';

import { Github, Menu, Terminal, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

export function LandingNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 md:px-12">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold">
          <div className="size-8 bg-primary rounded-md flex items-center justify-center">
            <Terminal className="size-5 text-primary-foreground" />
          </div>
          <span className="text-base font-extrabold tracking-tight uppercase">
            Rustrak
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/getting-started/overview"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Documentation
          </Link>
          <Link
            href="https://github.com/AbianS/rustrak"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <Github className="size-4" />
            GitHub
          </Link>
          <Button asChild size="sm">
            <Link href="/getting-started/installation">Get Started</Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-md">
          <div className="flex flex-col px-6 py-4 gap-4">
            <Link
              href="/getting-started/overview"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              Documentation
            </Link>
            <Link
              href="https://github.com/AbianS/rustrak"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              <Github className="size-4" />
              GitHub
            </Link>
            <Button asChild size="sm" className="w-full">
              <Link
                href="/getting-started/installation"
                onClick={() => setIsMenuOpen(false)}
              >
                Get Started
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
