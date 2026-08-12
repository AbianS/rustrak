import { redirect } from 'next/navigation';

export default async function SettingsPage() {
  await redirect('/settings/tokens');
}
