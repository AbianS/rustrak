'use client';

import { AlertCircle, Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface EventTagsProps {
  tags: Record<string, string> | undefined;
}

interface TagRowProps {
  tagKey: string;
  tagValue: string;
}

function TagRow({ tagKey, tagValue }: TagRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`${tagKey}:${tagValue}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-4 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors group">
      <div className="w-1/3 min-w-0">
        <span className="text-sm font-medium text-muted-foreground truncate block">
          {tagKey}
        </span>
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="font-mono text-sm truncate">{tagValue}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 w-6 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? (
            <Check className="size-3 text-primary" />
          ) : (
            <Copy className="size-3" />
          )}
        </Button>
      </div>
    </div>
  );
}

export function EventTags({ tags }: EventTagsProps) {
  if (!tags || Object.keys(tags).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="size-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">No tags found for this event</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Tags are metadata attached to events by Sentry SDKs
        </p>
      </div>
    );
  }

  // Group tags into categories
  const categorizedTags: Record<string, Record<string, string>> = {
    deployment: {},
    runtime: {},
    device: {},
    user: {},
    other: {},
  };

  const deploymentKeys = ['environment', 'release', 'server_name', 'site'];
  const runtimeKeys = [
    'runtime',
    'runtime.name',
    'runtime.version',
    'language',
    'sdk.name',
    'sdk.version',
  ];
  const deviceKeys = [
    'browser',
    'browser.name',
    'device',
    'device.family',
    'os',
    'os.name',
    'os.version',
  ];
  const userKeys = [
    'user',
    'user.id',
    'user.email',
    'user.username',
    'user.ip_address',
  ];

  for (const [key, value] of Object.entries(tags)) {
    if (deploymentKeys.some((k) => key.toLowerCase().startsWith(k))) {
      categorizedTags.deployment[key] = value;
    } else if (runtimeKeys.some((k) => key.toLowerCase().startsWith(k))) {
      categorizedTags.runtime[key] = value;
    } else if (deviceKeys.some((k) => key.toLowerCase().startsWith(k))) {
      categorizedTags.device[key] = value;
    } else if (userKeys.some((k) => key.toLowerCase().startsWith(k))) {
      categorizedTags.user[key] = value;
    } else {
      categorizedTags.other[key] = value;
    }
  }

  const sections = [
    {
      key: 'deployment',
      label: 'Deployment',
      tags: categorizedTags.deployment,
    },
    { key: 'runtime', label: 'Runtime', tags: categorizedTags.runtime },
    { key: 'device', label: 'Device / Browser', tags: categorizedTags.device },
    { key: 'user', label: 'User', tags: categorizedTags.user },
    { key: 'other', label: 'Other Tags', tags: categorizedTags.other },
  ].filter((section) => Object.keys(section.tags).length > 0);

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.key} className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {section.label}
          </h4>
          <div className="bg-card rounded-lg border">
            <div className="px-4">
              {Object.entries(section.tags).map(([key, value]) => (
                <TagRow key={key} tagKey={key} tagValue={value} />
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* Summary */}
      <p className="text-xs text-muted-foreground">
        {Object.keys(tags).length} tag
        {Object.keys(tags).length !== 1 ? 's' : ''} attached to this event
      </p>
    </div>
  );
}
