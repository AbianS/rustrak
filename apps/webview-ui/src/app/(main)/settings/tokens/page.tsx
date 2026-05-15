import { BookOpen, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { listTokens } from '@/actions/tokens';
import { TokensList } from './tokens-list';

export const metadata: Metadata = {
  title: 'API Tokens | Rustrak',
  description: 'Manage your API tokens',
};

export default async function TokensPage() {
  const tokens = await listTokens();

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight">API Tokens</h1>
        <p className="text-muted-foreground mt-1">
          Manage your API tokens for programmatic access
        </p>
      </div>

      <Link
        href="https://abians.github.io/rustrak/api-reference"
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

      <TokensList initialTokens={tokens} />
    </>
  );
}
