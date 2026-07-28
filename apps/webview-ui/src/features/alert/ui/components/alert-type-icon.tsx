import { Bell, BellOff, RefreshCw, Zap } from 'lucide-react';

/**
 * The mark for an alert trigger.
 *
 * Same shape as `ProviderIcon`, and for the same reason: the type is a string
 * off the wire, so an unknown one has to render something.
 */
export function AlertTypeIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  switch (type) {
    case 'new_issue':
      return <Zap className={className} />;
    case 'regression':
      return <RefreshCw className={className} />;
    case 'unmute':
      return <BellOff className={className} />;
    default:
      return <Bell className={className} />;
  }
}
