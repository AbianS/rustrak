'use client';

import { AlertCircle, Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/shared/lib/clipboard';
import { Button } from '@/shared/ui/components/shadcn/button';

interface EventTagsProps {
  tags: Record<string, string> | undefined;
}

interface TagRowProps {
  tagKey: string;
  tagValue: string;
}

function TagRow({ tagKey, tagValue }: TagRowProps) {
  const t = useTranslations('events');
  const common = useTranslations('common');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!(await copyToClipboard(`${tagKey}:${tagValue}`))) {
      toast.info(common('clipboardUnavailable'), {
        description: t('clipboardValueHint'),
      });
      return;
    }

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
  const t = useTranslations('events');

  if (!tags || Object.keys(tags).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="size-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">{t('tags.emptyTitle')}</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          {t('tags.emptyHint')}
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
      labelKey: 'tags.deployment',
      tags: categorizedTags.deployment,
    },
    { key: 'runtime', labelKey: 'tags.runtime', tags: categorizedTags.runtime },
    {
      key: 'device',
      labelKey: 'tags.device',
      tags: categorizedTags.device,
    },
    { key: 'user', labelKey: 'tags.user', tags: categorizedTags.user },
    { key: 'other', labelKey: 'tags.other', tags: categorizedTags.other },
  ].filter((section) => Object.keys(section.tags).length > 0);

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.key} className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t(section.labelKey)}
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
        {t('tags.attachedCount', { count: Object.keys(tags).length })}
      </p>
    </div>
  );
}
