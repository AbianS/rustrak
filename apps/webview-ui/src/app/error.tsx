'use client';

import { RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { ErrorScreen } from '@/shared/ui/components/error-screen';
import { Button } from '@/shared/ui/components/shadcn/button';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <ErrorScreen
      headline="Something went wrong"
      description="This page could not be rendered. The failure happened in the dashboard rather than in your data, which is untouched."
      guidance="If it happens again after a reload, the error ID below is what identifies this specific failure in the logs."
      detail={error.digest ? `Error ID: ${error.digest}` : null}
      actions={
        <>
          <Button onClick={reset}>
            <RefreshCw className="mr-2 size-4" />
            Try again
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = '/projects';
            }}
          >
            Go to Projects
          </Button>
        </>
      }
    />
  );
}
