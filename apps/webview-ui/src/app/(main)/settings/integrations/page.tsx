import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { listIntegrations } from '@/features/alert/api/queries';
import { IntegrationsList } from '@/features/alert/ui/components/integrations-list/integrations-list';
import { LoadFailure } from '@/shared/ui/components/load-failure';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return {
    title: t('integrations.meta.title'),
    description: t('integrations.meta.description'),
  };
}

export default async function IntegrationsPage() {
  const t = await getTranslations('settings');
  const integrations = await listIntegrations();

  if (!integrations.success) {
    return (
      <LoadFailure
        error={integrations.error}
        title={t('integrations.loadFailed')}
        notFoundOnMissing={false}
      />
    );
  }

  return (
    <>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
          {t('integrations.title')}
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          {t('integrations.subtitle')}
        </p>
      </div>

      <IntegrationsList initialIntegrations={integrations.data} />
    </>
  );
}
