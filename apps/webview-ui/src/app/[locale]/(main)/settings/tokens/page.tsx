import { BookOpen, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { listTokens } from '@/features/token/api/queries';
import { TokensList } from '@/features/token/ui/components/tokens-list/tokens-list';
import { Link } from '@/shared/i18n/navigation';
import { LoadFailure } from '@/shared/ui/components/load-failure';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return {
    title: t('tokens.meta.title'),
    description: t('tokens.meta.description'),
  };
}

export default async function TokensPage() {
  const t = await getTranslations('settings');
  const tokens = await listTokens();

  if (!tokens.success) {
    return (
      <LoadFailure
        error={tokens.error}
        title={t('tokens.loadFailed')}
        notFoundOnMissing={false}
      />
    );
  }

  return (
    <>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
          {t('tokens.title')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('tokens.subtitle')}</p>
      </div>

      <Link
        href="https://rustrak.github.io/rustrak/api-reference"
        target="_blank"
        rel="noopener noreferrer"
        className="mb-6 flex items-center gap-4 rounded-lg border bg-card px-5 py-4 transition-colors hover:bg-accent group"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <BookOpen className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-none">
            {t('tokens.apiReference')}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {t('tokens.apiReferenceDescription')}
          </p>
        </div>
        <ExternalLink className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
      </Link>

      <TokensList initialTokens={tokens.data} />
    </>
  );
}
