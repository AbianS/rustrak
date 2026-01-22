import { Terminal } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_VERSION } from '@/lib/constants';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Log in | Rustrak',
  description: 'Sign in to your Rustrak account',
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Decorative (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-background flex-col justify-between p-12 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_hsl(var(--card)),_transparent_50%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10" />

        {/* Brand */}
        <Link href="/" className="relative z-20 flex items-center gap-2 w-fit">
          <div className="size-8 bg-primary rounded-sm flex items-center justify-center shadow-[0_0_15px_hsl(var(--primary)/0.3)]">
            <Terminal className="size-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-extrabold tracking-tight uppercase">
            Rustrak
          </span>
        </Link>

        {/* Welcome message */}
        <div className="relative z-20 max-w-xl">
          <h2 className="text-6xl xl:text-7xl font-extrabold tracking-tighter leading-[1.05] mb-8">
            Welcome back to Rustrak
            <span className="text-primary">.</span>
          </h2>
          <p className="text-muted-foreground text-lg font-medium leading-relaxed max-w-md">
            Lightweight, self-hosted error tracking. Access your dashboard to
            monitor system health and resolve critical incidents.
          </p>

          {/* Stats */}
          <div className="mt-12 flex items-center gap-8">
            <div>
              <span className="text-2xl font-bold text-primary">50MB</span>
              <p className="text-sm text-muted-foreground">Memory footprint</p>
            </div>
            <div>
              <span className="text-2xl font-bold text-primary">&lt;50ms</span>
              <p className="text-sm text-muted-foreground">Ingestion latency</p>
            </div>
            <div>
              <span className="text-2xl font-bold text-primary">10k+</span>
              <p className="text-sm text-muted-foreground">Events/second</p>
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
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="size-8 bg-primary rounded-sm flex items-center justify-center">
              <Terminal className="size-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-extrabold tracking-tight uppercase">
              Rustrak
            </span>
          </div>

          {/* Form */}
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
