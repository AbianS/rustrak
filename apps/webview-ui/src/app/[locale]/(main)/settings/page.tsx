import { redirect } from '@/shared/i18n/redirect';

export default async function SettingsPage() {
  await redirect('/settings/tokens');
}
