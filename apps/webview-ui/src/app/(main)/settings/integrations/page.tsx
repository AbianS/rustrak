import type { Metadata } from 'next';
import { listIntegrations } from '@/actions/alerts';
import { IntegrationsList } from './integrations-list';

export const metadata: Metadata = {
  title: 'Integrations | Rustrak',
  description: 'Connect Rustrak with your tools and services',
};

export default async function IntegrationsPage() {
  const integrations = await listIntegrations();

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

      <IntegrationsList initialIntegrations={integrations} />
    </>
  );
}
