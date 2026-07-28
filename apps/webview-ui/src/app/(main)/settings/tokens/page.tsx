import { BookOpen, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LoadFailure } from '@/components/load-failure';
import { listTokens } from '@/features/token/api/queries';
import { TokensList } from '@/features/token/ui/tokens-list';

export const metadata: Metadata = {
  title: 'API Tokens | Rustrak',
  description: 'Manage your API tokens',
};

export default async function TokensPage() {
  const tokens = await listTokens();

  if (!tokens.success) {
    return (
      <LoadFailure
        error={tokens.error}
        title="Could not load API tokens"
        notFoundOnMissing={false}
      />
    );
  }

  return (
    <>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
          API Tokens
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your API tokens for programmatic access
        </p>
      </div>

      <Link
        href="https://rustrak.github.io/rustrak/api-reference"
        target="_blank"
        rel="noopener noreferrer"
        className="mb-6 flex items-center gap-4 rounded-lg border bg-card px-5 py-4 transition-colors hover:bg-accent group"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <BookOpen className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-none">API Reference</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Full documentation for all endpoints, authentication, and request
            examples
          </p>
        </div>
        <ExternalLink className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
      </Link>

      <TokensList initialTokens={tokens.data} />
    </>
  );
}
