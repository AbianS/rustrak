import type { Metadata } from 'next';
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

      <TokensList initialTokens={tokens} />
    </>
  );
}
