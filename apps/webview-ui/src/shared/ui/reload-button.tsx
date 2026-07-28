'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/shared/ui/shadcn/button';

/**
 * A reload button for a screen rendered by a Server Component.
 *
 * `router.refresh()` is deliberately not used: the surfaces this appears on
 * failed because the API could not be reached, and a soft refresh re-runs the
 * same RSC request through the same client. A full document load also drops
 * whatever stale module state the failed render left behind.
 */
export function ReloadButton({ children = 'Reload' }: { children?: string }) {
  return (
    <Button onClick={() => window.location.reload()}>
      <RefreshCw className="mr-2 size-4" />
      {children}
    </Button>
  );
}
