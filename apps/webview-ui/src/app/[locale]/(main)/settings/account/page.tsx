import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/features/user/api/queries';
import { redirect } from '@/shared/i18n/redirect';
import { LanguageSelector } from '@/shared/ui/components/language-selector';
import { ServiceUnavailable } from '@/shared/ui/components/service-unavailable';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/components/shadcn/card';
import { Label } from '@/shared/ui/components/shadcn/label';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return {
    title: t('account.meta.title'),
    description: t('account.meta.description'),
  };
}

export default async function AccountPage() {
  const t = await getTranslations('settings');
  const session = await getCurrentUser();

  // Only `anonymous`. The page is nothing but a read of the current user, so
  // on `unavailable` there is nothing to render and nothing login would fix.
  if (session.state === 'anonymous') {
    return redirect('/auth/login');
  }

  if (session.state === 'unavailable') {
    return <ServiceUnavailable error={session.error} />;
  }

  const user = session.user;

  return (
    <>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
          {t('account.title')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('account.subtitle')}</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('account.profile')}</CardTitle>
            <CardDescription>{t('account.profileDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">
                {t('account.email')}
              </Label>
              <p className="text-sm font-medium">{user.email}</p>
            </div>
            {user.is_admin && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  {t('account.role')}
                </Label>
                <p className="text-sm font-medium">
                  {t('account.administrator')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* The home for everything that is "how I want this read to me" rather
            than "who I am". Language today; the timezone preference in
            rustrak/rustrak#258 belongs in this card, not in a second one. */}
        <Card>
          <CardHeader>
            <CardTitle>{t('account.regional')}</CardTitle>
            <CardDescription>
              {t('account.regionalDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageSelector />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
