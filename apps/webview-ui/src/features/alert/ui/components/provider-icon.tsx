import { Bell, Hash, Mail, Webhook } from 'lucide-react';

/**
 * The mark for an alert provider.
 *
 * `Bell` is the fallback rather than a missing glyph: the server may name a
 * provider this build has never heard of, and a row with no icon reads as a
 * broken row instead of an unfamiliar one.
 */
export function ProviderIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  switch (type) {
    case 'slack':
      return <Hash className={className} />;
    case 'email':
      return <Mail className={className} />;
    case 'webhook':
      return <Webhook className={className} />;
    default:
      return <Bell className={className} />;
  }
}
