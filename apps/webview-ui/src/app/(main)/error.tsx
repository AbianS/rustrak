'use client';

import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/shared/ui/shadcn/button';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function MainError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to console in development
    console.error('Application error:', error);
  }, [error]);

  // No brand panel here, unlike `app/error.tsx`. This boundary renders *below*
  // the header, which already carries the Rustrak mark and the navigation, so a
  // second brand panel would compete with it and strand the user in a screen
  // that looks like a logout.
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-20">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle
              className="size-5 text-destructive"
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight">
            This page could not be loaded
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The failure happened while rendering, not in your data. Everything
            else in the dashboard is still reachable from the header above.
          </p>
        </div>

        {error.digest && (
          <p className="text-xs text-muted-foreground font-mono">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex justify-center gap-4">
          <Button onClick={reset} variant="default">
            <RefreshCw className="mr-2 size-4" />
            Try again
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/projects" />}
          >
            <Home className="mr-2 size-4" />
            Go to Projects
          </Button>
        </div>
      </div>
    </div>
  );
}
