import { redirect } from '@/i18n/redirect';

export default async function SettingsPage() {
  await redirect('/settings/tokens');
}
