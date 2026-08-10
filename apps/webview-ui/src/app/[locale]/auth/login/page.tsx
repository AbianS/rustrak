import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { APP_VERSION } from '@/shared/config/constants';
import { RustrakWordmark } from '@/shared/ui/components/rustrak-wordmark';
import { LoginForm } from './_components/login-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return {
    title: t('meta.title'),
    description: t('meta.description'),
  };
}

export default async function LoginPage() {
  const t = await getTranslations('auth');

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Decorative (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-background flex-col justify-between p-12 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_hsl(var(--card)),_transparent_50%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10" />

        {/* Brand */}
        <Link href="/" className="relative z-20 flex items-center w-fit">
          <RustrakWordmark className="h-[22px] w-auto" />
        </Link>

        {/* Welcome message */}
        <div className="relative z-20 max-w-xl">
          <h2 className="text-6xl xl:text-7xl font-extrabold tracking-tighter leading-[1.05] mb-8">
            {t('heroTitle')}
            <span className="text-primary">.</span>
          </h2>
          <p className="text-muted-foreground text-lg font-medium leading-relaxed max-w-md">
            {t('heroDescription')}
          </p>

          {/* Stats */}
          <div className="mt-12 flex items-center gap-8">
            <div>
              <span className="text-2xl font-bold text-primary">50MB</span>
              <p className="text-sm text-muted-foreground">
                {t('statMemoryFootprint')}
              </p>
            </div>
            <div>
              <span className="text-2xl font-bold text-primary">&lt;50ms</span>
              <p className="text-sm text-muted-foreground">
                {t('statIngestionLatency')}
              </p>
            </div>
            <div>
              <span className="text-2xl font-bold text-primary">10k+</span>
              <p className="text-sm text-muted-foreground">
                {t('statEventsPerSecond')}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-20 flex justify-between items-end text-xs text-muted-foreground font-mono">
          <div>
            <p className="mt-1">v{APP_VERSION}</p>
          </div>
          <div className="flex gap-6">
            <p>&copy; {new Date().getFullYear()} Rustrak</p>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 bg-card flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-[420px] space-y-10">
          {/* Mobile brand (hidden on desktop) */}
          <div className="lg:hidden flex items-center mb-8">
            <RustrakWordmark className="h-[22px] w-auto" />
          </div>

          {/* Form */}
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
