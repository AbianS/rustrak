import type { Metadata } from 'next';
import { listNotificationChannels } from '@/actions/alerts';
import { AlertChannelsList } from './alert-channels-list';

export const metadata: Metadata = {
  title: 'Global Alerts | Rustrak',
  description: 'Configure global alert destinations for Rustrak',
};

export default async function AlertsPage() {
  const channels = await listNotificationChannels();

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Global Alert Destinations
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Configure integration channels to receive real-time notifications
          about errors and issues. Select a service below to configure
          credentials and triggers.
        </p>
      </div>

      <AlertChannelsList initialChannels={channels} />
    </>
  );
}
