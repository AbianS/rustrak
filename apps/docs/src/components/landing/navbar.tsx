import { Github, Terminal } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export function LandingNavbar() {
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

        {/* Navigation Links */}
        <div className="flex items-center gap-6">
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
            <span className="hidden sm:inline">GitHub</span>
          </Link>
          <Button asChild size="sm">
            <Link href="/getting-started/installation">Get Started</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
