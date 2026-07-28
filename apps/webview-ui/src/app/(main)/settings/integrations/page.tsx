import type { Metadata } from 'next';
import { listIntegrations } from '@/features/alert/api/queries';
import { IntegrationsList } from '@/features/alert/ui/integrations-list';
import { LoadFailure } from '@/shared/ui/load-failure';

export const metadata: Metadata = {
  title: 'Integrations | Rustrak',
  description: 'Connect Rustrak with your tools and services',
};

export default async function IntegrationsPage() {
  const integrations = await listIntegrations();

  if (!integrations.success) {
    return (
      <LoadFailure
        error={integrations.error}
        title="Could not load integrations"
        notFoundOnMissing={false}
      />
    );
  }

  return (
    <>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
          Integrations
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Connect Rustrak with your tools and services to automate workflows and
          stay on top of errors.
        </p>
      </div>

      <IntegrationsList initialIntegrations={integrations.data} />
    </>
  );
}
