import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/components/shadcn/card';
import { ThemeSelector } from '@/shared/ui/components/theme-selector';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return {
    title: t('appearance.meta.title'),
    description: t('appearance.meta.description'),
  };
}

export default async function AppearancePage() {
  const t = await getTranslations('settings');

  return (
    <>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
          {t('appearance.title')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('appearance.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('appearance.theme')}</CardTitle>
          <CardDescription>{t('appearance.themeDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSelector />
        </CardContent>
      </Card>
    </>
  );
}
