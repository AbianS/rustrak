'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { ErrorScreen } from '@/shared/ui/components/error-screen';
import { Button } from '@/shared/ui/components/shadcn/button';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  const router = useRouter();
  const t = useTranslations('errors');

  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <ErrorScreen
      headline={t('global.headline')}
      description={t('global.description')}
      guidance={t('global.guidance')}
      detail={error.digest ? t('errorId', { id: error.digest }) : null}
      actions={
        <>
          <Button onClick={reset}>
            <RefreshCw className="mr-2 size-4" />
            {t('tryAgain')}
          </Button>
          <Button variant="outline" onClick={() => router.push('/projects')}>
            {t('goToProjects')}
          </Button>
        </>
      }
    />
  );
}
